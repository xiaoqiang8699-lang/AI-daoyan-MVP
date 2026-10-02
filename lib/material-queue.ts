import "server-only";
import { Queue } from "bullmq";

export type MaterialAnalysisJob = { batchId?: string };
export function getMaterialQueueConfig() { return { connection: { url: process.env.REDIS_URL || "redis://127.0.0.1:6380" }, name: process.env.MATERIAL_ANALYSIS_QUEUE_NAME || "material-analysis", prefix: process.env.BULLMQ_PREFIX || "bull" }; }
const globalQueue = globalThis as unknown as { materialAnalysisQueue?: Queue<MaterialAnalysisJob> };

export function getMaterialAnalysisQueue() {
  const config = getMaterialQueueConfig();
  globalQueue.materialAnalysisQueue ??= new Queue<MaterialAnalysisJob>(config.name, { connection: config.connection, prefix: config.prefix });
  return globalQueue.materialAnalysisQueue;
}

export async function enqueueMaterialAnalysis(batchId: string) {
  const existing = await getMaterialAnalysisQueue().getJob(batchId);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") await existing.remove();
    else return;
  }
  await getMaterialAnalysisQueue().add("analyze", { batchId }, { jobId: batchId, removeOnComplete: 100, removeOnFail: 100 });
}
