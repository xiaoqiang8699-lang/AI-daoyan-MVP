import "server-only";
import { Queue } from "bullmq";

export type FinalRenderJob = { projectId: string; finalVideoId: string; renderToken: string };
const connection = { url: process.env.REDIS_URL || "redis://127.0.0.1:6380" };
const globalQueue = globalThis as unknown as { finalRenderQueue?: Queue<FinalRenderJob> };

export function getFinalRenderQueue() {
  globalQueue.finalRenderQueue ??= new Queue<FinalRenderJob>("final-video-render", { connection });
  return globalQueue.finalRenderQueue;
}

export async function enqueueFinalRender(job: FinalRenderJob) {
  await getFinalRenderQueue().add("render", job, { jobId: job.renderToken, removeOnComplete: 100, removeOnFail: 100 });
}
