import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { KieVideoAIProvider } from "../packages/ai/providers/kie-video-ai-provider";
import { safeTrim } from "../lib/final-video";
import { probeVideo } from "../lib/video";

const root = path.resolve("test-results/trim-benchmark");
const apiKey = process.env.KIE_API_KEY;
if (!apiKey) throw new Error("KIE_API_KEY is required");
const provider = new KieVideoAIProvider({ apiKey, model: process.env.KIE_TAKE_TRIM_MODEL || process.env.KIE_VIDEO_MODEL || "gemini-3-8-flash", uploadAuditPath: path.join(root, "upload-audit.jsonl") });
const cases = [
  ["A", 2.6, "展示窗边百叶帘", "缓慢横向移动一次"], ["B", 2.7, "展示针织开衫", "完整置于画面中央"],
  ["C", 2.6, "展示百叶窗", "拉动控制绳升起"], ["D", 5, "展示顶灯和衣架", "依次停留"],
  ["E", 7, "展示座椅和打印设备", "全程固定"], ["F", 3.6, "展示马克杯", "转动杯柄"],
] as const;

async function main() {
  await mkdir(root, { recursive: true });
  const results = [];
  const selected = process.env.TRIM_CASE ? cases.filter(([id]) => id === process.env.TRIM_CASE) : cases;
  for (const [id, targetDuration, purpose, actionInstruction] of selected) {
    const started = Date.now(); const takePath = path.join(root, `trim-${id.toLowerCase()}.mp4`);
    try {
      const metadata = await probeVideo(takePath, "mp4");
      const trim = await provider.selectTakeTrim!({ referenceShot: { visualDescription: "无人物的简短参考动作。", targetDuration }, plannedShot: { actionInstruction, cameraInstruction: "保持主体完整可见。", dialogue: null, targetDuration }, take: { localFilePath: takePath, mimeType: "video/mp4", duration: metadata.duration }, referenceClip: { localFilePath: path.join(root, "reference-clip.mp4"), mimeType: "video/mp4" } });
      const safe = safeTrim({ duration: metadata.duration, targetDuration, dialogue: null, trim: { id, ...trim } });
      results.push({ id, targetDuration, purpose, takeFile: path.basename(takePath), trim, accepted: safe.source === "AUTO", elapsedMs: Date.now() - started });
    } catch (error) { results.push({ id, targetDuration, purpose, error: error instanceof Error ? error.message : String(error), detail: error && typeof error === "object" && "cause" in error ? String((error as Error & { cause?: unknown }).cause) : null, accepted: false, elapsedMs: Date.now() - started }); }
  }
  await writeFile(path.join(root, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  process.stdout.write(JSON.stringify({ total: results.length, accepted: results.filter((item) => item.accepted).length, results }, null, 2));
}
void main();
