import "dotenv/config";
import { Worker } from "bullmq";
import { analyzeMaterialBatch } from "../lib/materials";
import { getMaterialQueueConfig, type MaterialAnalysisJob } from "../lib/material-queue";
import { getMaterialAIConfig } from "../packages/ai/get-material-ai-provider";

async function main() {
  const queue = getMaterialQueueConfig(); const ai = getMaterialAIConfig(); const workerId = `material-smoke-${process.pid}`;
  const worker = new Worker<MaterialAnalysisJob>(queue.name, async (job) => {
    if (job.name === "isolation-probe") return { workerId };
    if (!job.data.batchId) throw new Error("MISSING_BATCH_ID");
    return analyzeMaterialBatch(job.data.batchId);
  }, { connection: queue.connection, prefix: queue.prefix, concurrency: 1 });
  worker.on("failed", (job, error) => console.error(JSON.stringify({ event: "material_analysis.failed", jobId: job?.id, error: error.message })));
  await worker.waitUntilReady();
  console.log(JSON.stringify({ event: "material_worker.ready", workerId, queueName: queue.name, bullmqPrefix: queue.prefix, redisUrl: queue.connection.url, provider: ai.provider, model: ai.model }));
}
void main();
