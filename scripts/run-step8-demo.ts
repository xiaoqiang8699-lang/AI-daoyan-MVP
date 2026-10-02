import "dotenv/config";
import { db } from "../lib/db";
import { renderFinalVideo, reserveFinalRender } from "../lib/final-video";

const projectId = "cmu45kv4g0000a0ra8geg27oy";
async function main() { const track = await db.bgmTrack.findFirstOrThrow({ where: { active: true, category: "轻松" } }); await db.videoRenderSettings.upsert({ where: { projectId }, create: { projectId, subtitleEnabled: true, bgmEnabled: true, bgmTrackId: track.id }, update: { subtitleEnabled: true, bgmEnabled: true, bgmTrackId: track.id, bgmVolume: 0.14, version: { increment: 1 } } }); const job = await reserveFinalRender(projectId); if (!job.busy) await renderFinalVideo(projectId, job.finalVideoId, job.renderToken); const video = await db.finalVideo.findUniqueOrThrow({ where: { projectId }, include: { subtitleTrack: true, finalQa: true } }); console.log(JSON.stringify({ base: video.baseFileUrl, enhanced: video.enhancedFileUrl, duration: video.duration, fileSize: video.fileSize, subtitle: video.subtitleTrack?.status, qa: video.finalQa?.status, renderDurationMs: video.renderDurationMs }, null, 2)); await db.$disconnect(); }
void main();
