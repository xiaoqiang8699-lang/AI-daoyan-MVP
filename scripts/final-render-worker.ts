import "dotenv/config";
import { Worker } from "bullmq";
import { renderFinalVideo } from "../lib/final-video";
import { renderProductionFinalVideo } from "../lib/production-final-video";
import type { FinalRenderJob } from "../lib/render-queue";

async function main() {
  const worker = new Worker<FinalRenderJob>("final-video-render", async (job) => job.data.sourceType === "CONTENT_PRODUCTION" ? renderProductionFinalVideo(job.data.productionPlanId!, job.data.finalVideoId, job.data.renderToken) : renderFinalVideo(job.data.projectId!, job.data.finalVideoId, job.data.renderToken), { connection: { url: process.env.REDIS_URL || "redis://127.0.0.1:6380" }, concurrency: 1 });
  worker.on("completed", (job) => console.log(JSON.stringify({ event: "final_render.completed", jobId: job.id })));
  worker.on("failed", (job, error) => console.error(JSON.stringify({ event: "final_render.failed", jobId: job?.id, error: error.message })));
  await worker.waitUntilReady(); console.log("Final video render worker is ready.");
}
void main();
