import "dotenv/config";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/db";
import { renderFinalVideo, reserveFinalRender } from "../lib/final-video";
import { getStorageProvider } from "../lib/storage";
import { probeVideo } from "../lib/video";

const projectId = "cmu45kv4g0000a0ra8geg27oy";
const output = path.resolve("test-results/step8-acceptance");
function key(url: string) { return url.replace("/api/files/", ""); }
async function copyVersion(name: string, url: string, extra: Record<string, unknown>) {
  const file = await getStorageProvider().getLocalFile(key(url));
  const destination = path.join(output, `${name}.mp4`);
  await copyFile(file.path, destination);
  const metadata = await probeVideo(destination, "mp4");
  return { version: name, file: path.relative(process.cwd(), destination).replace(/\\/g, "/"), duration: metadata.duration, fileSize: (await stat(destination)).size, ...extra };
}
async function render() {
  const reservation = await reserveFinalRender(projectId);
  if (!reservation.busy) await renderFinalVideo(projectId, reservation.finalVideoId, reservation.renderToken);
  return db.finalVideo.findUniqueOrThrow({ where: { projectId }, include: { subtitleTrack: true, finalQa: true } });
}
async function main() {
  await mkdir(output, { recursive: true });
  const current = await db.finalVideo.findUniqueOrThrow({ where: { projectId }, include: { subtitleTrack: true, finalQa: true } });
  if (!current.baseFileUrl) throw new Error("base final video missing");
  const versions = [await copyVersion("A-smart-trim-base", current.baseFileUrl, { subtitleStatus: "DISABLED", bgm: false, renderDurationMs: current.renderDurationMs, qa: current.finalQa?.status })];
  await db.videoRenderSettings.update({ where: { projectId }, data: { subtitleEnabled: true, bgmEnabled: false, version: { increment: 1 } } });
  const b = await render();
  if (!b.enhancedFileUrl) throw new Error("subtitle video missing");
  versions.push(await copyVersion("B-smart-trim-subtitle", b.enhancedFileUrl, { subtitleStatus: b.subtitleTrack?.status, bgm: false, renderDurationMs: b.renderDurationMs, qa: b.finalQa?.status }));
  const track = await db.bgmTrack.findFirstOrThrow({ where: { active: true, category: "轻松" } });
  await db.videoRenderSettings.update({ where: { projectId }, data: { subtitleEnabled: true, bgmEnabled: true, bgmTrackId: track.id, bgmVolume: 0.14, version: { increment: 1 } } });
  const c = await render();
  if (!c.enhancedFileUrl) throw new Error("BGM video missing");
  versions.push(await copyVersion("C-smart-trim-subtitle-bgm", c.enhancedFileUrl, { subtitleStatus: c.subtitleTrack?.status, bgm: { enabled: true, volume: 0.14, track: track.name }, renderDurationMs: c.renderDurationMs, qa: c.finalQa?.status }));
  await writeFile(path.join(output, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), project: "isolated-render-demo", versions }, null, 2));
  console.log(JSON.stringify(versions, null, 2));
  await db.$disconnect();
}
void main();
