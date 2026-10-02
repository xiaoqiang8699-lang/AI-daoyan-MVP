import "dotenv/config";
import { Queue, QueueEvents } from "bullmq";
import { getMaterialQueueConfig, type MaterialAnalysisJob } from "../lib/material-queue";

async function main() {
  const config = getMaterialQueueConfig();
  const queue = new Queue<MaterialAnalysisJob>(config.name, { connection: config.connection, prefix: config.prefix });
  const workers = await queue.getWorkers();
  if (workers.length !== 1) throw new Error(`SMOKE_CONSUMER_COUNT_${workers.length}`);

  const events = new QueueEvents(config.name, { connection: config.connection, prefix: config.prefix });
  await events.waitUntilReady();
  const job = await queue.add("isolation-probe", {}, { removeOnComplete: true, removeOnFail: true });
  const result = await job.waitUntilFinished(events, 10_000);
  if (!result || typeof result !== "object" || !("workerId" in result) || typeof result.workerId !== "string") {
    throw new Error("INVALID_PROBE_RESULT");
  }
  console.log(JSON.stringify({ queueName: config.name, bullmqPrefix: config.prefix, redisUrl: config.connection.url, consumerCount: workers.length, workerId: result.workerId, queueIsolation: "PASS" }));
  await events.close();
  await queue.close();
}

void main().catch((error) => {
  console.error(JSON.stringify({ queueIsolation: "FAIL", error: error instanceof Error ? error.message : "UNKNOWN" }));
  process.exitCode = 1;
});
