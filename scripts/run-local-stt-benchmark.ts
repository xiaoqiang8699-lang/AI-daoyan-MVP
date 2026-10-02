import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LocalWhisperProvider } from "../packages/ai/providers/local-whisper-provider";
import { validateTranscript } from "../lib/enhancement";
import ffprobe from "ffprobe-static";
import { runVideoTool } from "../lib/video";

const root = path.resolve("test-results/local-stt-benchmark");
const cases = [
  { id: "A", file: "a-clear.mp3", spoken: "今天阳光很好。", expectation: "清晰中文口播" },
  { id: "B", file: "b-noise.mp3", spoken: "镜头已经准备好了。", expectation: "有轻微环境噪音" },
  { id: "C", file: "c-short.mp3", spoken: "开始吧。", expectation: "短句" },
  { id: "D", file: "d-silence.mp3", spoken: "无讲话", expectation: "不得生成幻觉字幕" },
  { id: "E", file: "smart-trim-local.mp3", spoken: "隔离 Render Demo 的 Smart Trim 原始音频", expectation: "真实 Smart Trim 片段" },
];

async function audioDuration(filePath: string) {
  const output = await runVideoTool(ffprobe.path, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath]);
  const duration = Number(output.toString().trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`invalid audio duration: ${filePath}`);
  return duration;
}

async function main() {
  await mkdir(root, { recursive: true });
  const provider = new LocalWhisperProvider({ model: process.env.LOCAL_WHISPER_MODEL || "base" });
  const results = [];
  for (const item of cases) {
    const localFilePath = path.join(root, item.file);
    const duration = await audioDuration(localFilePath);
    const started = Date.now();
    const result = await provider.transcribe({ localFilePath, mimeType: "audio/mpeg", duration });
    const segments = validateTranscript(result.segments, duration);
    results.push({ ...item, duration, language: result.language, segments, transcriptionDurationMs: Date.now() - started, usable: item.id === "D" ? segments.length === 0 : segments.length > 0 });
  }
  await writeFile(path.join(root, "results.json"), JSON.stringify({ provider: "local-whisper", model: process.env.LOCAL_WHISPER_MODEL || "base", generatedAt: new Date().toISOString(), cases: results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
void main();
