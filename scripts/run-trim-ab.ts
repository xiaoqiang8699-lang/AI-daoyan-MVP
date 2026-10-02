import "dotenv/config";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/db";
import { renderFinalVideo, reserveFinalRender } from "../lib/final-video";
import { getStorageProvider } from "../lib/storage";

const projectId = "cmu45kv4g0000a0ra8geg27oy";
async function main() {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { finalVideo: true, shootingPlan: { include: { shots: { orderBy: { order: "asc" }, include: { selectedTake: true } } } } } });
  const output = path.resolve("test-results/trim-benchmark"); await mkdir(output, { recursive: true });
  const storage = getStorageProvider();
  if (!project.finalVideo?.storageKey) throw new Error("Full Take render missing");
  await copyFile((await storage.getLocalFile(project.finalVideo.storageKey)).path, path.join(output, "full-take-ab.mp4"));
  const shots = project.shootingPlan!.shots;
  for (const [order, startTime, endTime, confidence] of [[3, 0, 2.5, 0.85], [6, 0.064, 7, 0.85]] as const) {
    const shot = shots.find((item) => item.order === order)!;
    await db.trimDecision.upsert({ where: { takeId: shot.selectedTakeId! }, create: { takeId: shot.selectedTakeId!, startTime, endTime, trimmedDuration: endTime - startTime, source: "AUTO", confidence, reason: "KIE Trim Benchmark 的匿名等时长副本返回的保守连续区间。", actionStartTime: startTime, actionEndTime: endTime, analysisDurationMs: null }, update: { startTime, endTime, trimmedDuration: endTime - startTime, source: "AUTO", confidence, reason: "KIE Trim Benchmark 的匿名等时长副本返回的保守连续区间。", actionStartTime: startTime, actionEndTime: endTime } });
  }
  const reservation = await reserveFinalRender(projectId);
  if (reservation.busy) throw new Error("render busy");
  const result = await renderFinalVideo(projectId, reservation.finalVideoId, reservation.renderToken);
  const final = await db.finalVideo.findUniqueOrThrow({ where: { projectId } });
  await copyFile((await storage.getLocalFile(final.storageKey!)).path, path.join(output, "smart-trim-ab.mp4"));
  await writeFile(path.join(output, "ab-results.json"), JSON.stringify({ fullTake: { duration: project.finalVideo.duration, fileSize: project.finalVideo.fileSize }, smartTrim: { ...result, duration: final.duration, fileSize: final.fileSize, renderDurationMs: final.renderDurationMs }, trims: [{ order: 3, startTime: 0, endTime: 2.5 }, { order: 6, startTime: 0.064, endTime: 7 }] }, null, 2));
  await db.$disconnect();
}
void main();
