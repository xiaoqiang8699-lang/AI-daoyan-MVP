import "server-only";
import { openAsBlob } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FinalQAProvider, FinalVideoQAResult } from "../final-qa-provider";
import type { SpeechToTextProvider, TranscriptResult } from "../speech-to-text-provider";

async function post(apiKey: string, url: string, body: BodyInit, json = false) {
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, ...(json ? { "Content-Type": "application/json" } : {}) }, body, signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`KIE HTTP ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}
async function upload(apiKey: string, filePath: string, mimeType: string, uploadPath: string, auditPath?: string) {
  const form = new FormData(); form.append("file", await openAsBlob(filePath, { type: mimeType }), `${randomUUID()}.${mimeType === "audio/mpeg" ? "mp3" : "mp4"}`); form.append("uploadPath", uploadPath);
  const result = await post(apiKey, "https://kieai.redpandaai.co/api/file-stream-upload", form);
  const url = (result.data as { downloadUrl?: unknown } | undefined)?.downloadUrl;
  if (typeof url !== "string" || !url.startsWith("https://")) throw new Error("KIE upload failed");
  if (auditPath) await appendFile(auditPath, `${JSON.stringify({ localFile: path.basename(filePath), uploadPath, url, uploadedAt: new Date().toISOString(), fileId: null, expiresAt: null, deletionStatus: "NOT_SUPPORTED" })}\n`, "utf8");
  return url;
}
function content(response: Record<string, unknown>) {
  const choices = response.choices as Array<{ message?: { content?: unknown } }> | undefined;
  const direct = choices?.[0]?.message?.content;
  if (typeof direct === "string") return direct;
  const candidates = response.candidates as Array<{ content?: { parts?: Array<{ text?: unknown; thought?: boolean }> } }> | undefined;
  const joined = candidates?.[0]?.content?.parts?.filter((item) => !item.thought && typeof item.text === "string").map((item) => item.text as string).join("");
  if (joined) return joined;
  throw new Error(`KIE response missing content: ${JSON.stringify(response).slice(0, 1000)}`);
}

export class KieEnhancementProvider implements SpeechToTextProvider, FinalQAProvider {
  constructor(private readonly config: { apiKey: string; model: string; uploadAuditPath?: string }) {}
  async transcribe(input: { localFilePath: string; mimeType: "audio/mpeg"; duration: number }): Promise<TranscriptResult> {
    const url = await upload(this.config.apiKey, input.localFilePath, input.mimeType, "ai-director/stt", this.config.uploadAuditPath);
    const schema = { type: "object", additionalProperties: false, required: ["language", "segments"], properties: { language: { type: "string" }, segments: { type: "array", items: { type: "object", additionalProperties: false, required: ["startTime", "endTime", "text"], properties: { startTime: { type: "number", minimum: 0 }, endTime: { type: "number", minimum: 0 }, text: { type: "string" } } } } } };
    const response = await post(this.config.apiKey, `https://api.kie.ai/${this.config.model}-openai/v1/chat/completions`, JSON.stringify({ model: this.config.model, stream: false, messages: [{ role: "system", content: "准确转写真实音频；没有清晰讲话时返回空 segments。不得改写原话。" }, { role: "user", content: [{ type: "text", text: `音频时长 ${input.duration.toFixed(3)} 秒。返回带秒级时间戳的中文转写。` }, { type: "image_url", image_url: { url } }] }], response_format: { type: "json_schema", json_schema: { name: "transcript", strict: true, schema } } }), true);
    const value = JSON.parse(content(response)) as TranscriptResult;
    return { language: typeof value.language === "string" ? value.language : null, segments: Array.isArray(value.segments) ? value.segments : [], providerMetadata: typeof response.credits_consumed === "number" ? { creditsConsumed: response.credits_consumed } : undefined };
  }
  async evaluateFinalVideo(input: { localFilePath: string; mimeType: "video/mp4"; duration: number; subtitleEnabled: boolean }): Promise<FinalVideoQAResult> {
    const url = await upload(this.config.apiKey, input.localFilePath, input.mimeType, "ai-director/final-qa", this.config.uploadAuditPath);
    const schema = { type: "object", additionalProperties: false, required: ["passed", "criticalIssues", "mainIssue", "advice", "confidence"], properties: { passed: { type: "boolean" }, criticalIssues: { type: "array", items: { type: "string", enum: ["BLACK_SCREEN", "BROKEN_VIDEO", "AUDIO_MISSING", "SUBTITLE_BLOCKING_SUBJECT", "SUBTITLE_DESYNC", "SHOT_RENDER_ERROR", "ORIENTATION_ERROR"] } }, mainIssue: { type: "string" }, advice: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 } } };
    const response = await post(this.config.apiKey, `https://api.kie.ai/${this.config.model}-openai/v1/chat/completions`, JSON.stringify({ model: this.config.model, stream: false, messages: [{ role: "system", content: "只检查成片技术故障：黑屏、损坏、音频、字幕遮挡或不同步、画面方向。不得评论外貌、创意或内容好坏。空字符串表示无问题。" }, { role: "user", content: [{ type: "text", text: `成片时长 ${input.duration.toFixed(3)} 秒；字幕 ${input.subtitleEnabled ? "已烧录" : "未开启"}。` }, { type: "image_url", image_url: { url } }] }], response_format: { type: "json_schema", json_schema: { name: "final_qa", strict: true, schema } } }), true);
    return JSON.parse(content(response)) as FinalVideoQAResult;
  }
}
