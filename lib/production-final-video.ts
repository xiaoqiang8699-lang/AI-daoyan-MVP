import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { WorkflowError } from "@/lib/errors";
import { getStorageProvider } from "@/lib/storage";
import { ffmpegBinary, hasAudioStream, probeVideo, runVideoCommand } from "@/lib/video";
import { finalProgramChecks, validateTranscript, writeAss } from "@/lib/enhancement";
import { getSpeechToTextProvider } from "@/lib/enhancement-providers";
import { recordProductEvent, recordUsage } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";
import { buildProductionTimeline, productionTimelineOutdated, type ProductionTimelineItem } from "@/lib/production-timeline";

const canvas = { width: 720, height: 1280 };

type ProductionSnapshot = { productionPlanId: string; timeline: ProductionTimelineItem[]; subtitleEnabled: boolean; bgmTrackId: string | null; bgmVolume: number; originalAudioVolume: number; version: number };

async function normalizeVideo(input: string, output: string, start: number, duration: number) {
  const audio = await hasAudioStream(input);
  const filter = `[0:v]fps=30,scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=decrease,pad=${canvas.width}:${canvas.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v]`;
  const inputs = ["-ss", start.toFixed(3), "-i", input, ...(audio ? [] : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"])] ;
  const audioMap = audio ? ["-map", "0:a:0"] : ["-map", "1:a:0"];
  await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", ...inputs, "-t", duration.toFixed(3), "-filter_complex", filter, "-map", "[v]", ...audioMap, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "23", "-r", "30", "-c:a", "aac", "-ar", "48000", "-shortest", "-movflags", "+faststart", "-y", output]);
}

async function normalizeImage(input: string, output: string, duration: number) {
  const filter = `fps=30,scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=decrease,pad=${canvas.width}:${canvas.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;
  await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-loop", "1", "-i", input, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-t", duration.toFixed(3), "-filter:v", filter, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "23", "-r", "30", "-c:a", "aac", "-ar", "48000", "-shortest", "-movflags", "+faststart", "-y", output]);
}

async function addEnhancements(base: string, output: string, bgm: string | null, subtitles: string | null, originalVolume: number, bgmVolume: number) {
  const inputs = ["-i", base];
  if (bgm) inputs.push("-stream_loop", "-1", "-i", bgm);
  const filters: string[] = [];
  if (subtitles) filters.push(`[0:v]subtitles='${subtitles.replace(/\\/g, "/").replace(/:/g, "\\:")}'[v]`);
  else filters.push("[0:v]null[v]");
  if (bgm) filters.push(`[0:a]volume=${originalVolume}[voice];[1:a]volume=${bgmVolume}[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=0[a]`);
  else filters.push(`[0:a]volume=${originalVolume}[a]`);
  await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", "-shortest", "-y", output]);
}

async function subtitlesForProduction(productionPlanId: string, finalVideoId: string, rendered: string, duration: number, work: string, enabled: boolean) {
  if (!enabled) return { subtitles: null, status: "NO_SPEECH" };
  const { provider, config } = getSpeechToTextProvider();
  const started = Date.now();
  try {
    const transcript = await provider.transcribe({ localFilePath: rendered, mimeType: "audio/mpeg", duration });
    const segments = validateTranscript(transcript.segments, duration);
    const ass = path.join(work, "subtitles.ass");
    if (segments.length) await writeAss(ass, segments, canvas.width, canvas.height);
    await db.subtitleTrack.upsert({ where: { finalVideoId }, create: { productionPlanId, finalVideoId, status: "READY", language: transcript.language, segments, provider: config.provider, model: config.model, transcriptionDurationMs: Date.now() - started }, update: { status: "READY", language: transcript.language, segments, provider: config.provider, model: config.model, transcriptionDurationMs: Date.now() - started, errorMessage: null } });
    await recordUsage({ operation: "SPEECH_TO_TEXT", provider: config.provider, model: config.model, durationMs: Date.now() - started });
    return { subtitles: segments.length ? ass : null, status: "READY" };
  } catch {
    await db.subtitleTrack.upsert({ where: { finalVideoId }, create: { productionPlanId, finalVideoId, status: "FAILED", errorMessage: "字幕生成失败" }, update: { status: "FAILED", errorMessage: "字幕生成失败" } });
    return { subtitles: null, status: "FAILED" };
  }
}

export async function reserveProductionFinalRender(productionPlanId: string) {
  const { plan, items } = await buildProductionTimeline(productionPlanId);
  const activeTrack = await db.bgmTrack.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const settings = await db.videoRenderSettings.upsert({ where: { productionPlanId }, create: { productionPlanId, subtitleEnabled: true, bgmEnabled: !!activeTrack, bgmTrackId: activeTrack?.id ?? null }, update: {} });
  const current = await db.finalVideo.findUnique({ where: { productionPlanId } });
  if (current?.status === "RENDERING") return { busy: true as const, finalVideoId: current.id, renderToken: current.renderToken! };
  const renderToken = randomUUID();
  const final = await db.finalVideo.upsert({ where: { productionPlanId }, create: { productionPlanId, sourceType: "CONTENT_PRODUCTION", status: "RENDERING", renderToken }, update: { status: "RENDERING", renderToken, errorMessage: null } });
  const snapshot: ProductionSnapshot = { productionPlanId: plan.id, timeline: items, subtitleEnabled: settings.subtitleEnabled, bgmTrackId: settings.bgmEnabled ? settings.bgmTrackId : null, bgmVolume: settings.bgmVolume, originalAudioVolume: settings.originalAudioVolume, version: settings.version };
  return { busy: false as const, finalVideoId: final.id, renderToken, snapshot };
}

export async function getProductionFinalVideoView(productionPlanId: string) {
  const { plan, items } = await buildProductionTimeline(productionPlanId, { allowOutdated: true });
  const final = await db.finalVideo.findUnique({ where: { productionPlanId }, include: { subtitleTrack: true, finalQa: true } });
  const outdated = !!final?.sourceSnapshot && productionTimelineOutdated(final.sourceSnapshot, items);
  if (outdated && final?.status === "READY") await db.finalVideo.update({ where: { id: final.id }, data: { status: "OUTDATED" } });
  return { productionId: plan.id, title: plan.title, status: plan.status, timeline: items, finalVideo: final ? { status: outdated ? "OUTDATED" : final.status, fileUrl: final.fileUrl, duration: final.duration, fileSize: final.fileSize, errorMessage: final.errorMessage, subtitleStatus: final.subtitleTrack?.status ?? null, bgmEnabled: !!final.sourceSnapshot && (final.sourceSnapshot as ProductionSnapshot).bgmTrackId !== null, finalQaStatus: final.finalQa?.status ?? null, outdated } : null };
}

export async function renderProductionFinalVideo(productionPlanId: string, finalVideoId: string, renderToken: string) {
  const started = Date.now(); const renderId = randomUUID(); const work = path.join(process.cwd(), ".tmp", "production-renders", renderId);
  await mkdir(work, { recursive: true });
  try {
    const { plan, items } = await buildProductionTimeline(productionPlanId);
    const final = await db.finalVideo.findFirst({ where: { id: finalVideoId, productionPlanId, status: "RENDERING", renderToken } });
    if (!final) throw new WorkflowError("RENDER_SUPERSEDED", "生成任务已被新的任务替代。", 409);
    const storage = getStorageProvider(); const normalized: string[] = [];
    for (const [index, item] of items.entries()) {
      const source = await storage.getLocalFile(item.mediaStorageKey);
      const file = path.join(work, `segment-${index}.mp4`);
      const duration = item.mediaType === "IMAGE" ? item.plannedDuration : (item.trimEnd ?? item.sourceDuration) - (item.trimStart ?? 0);
      if (item.mediaType === "IMAGE") await normalizeImage(source.path, file, duration);
      else await normalizeVideo(source.path, file, item.trimStart ?? 0, duration);
      normalized.push(file);
    }
    const concatList = path.join(work, "concat.txt");
    await writeFile(concatList, normalized.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
    const base = path.join(work, "base.mp4");
    await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", "-movflags", "+faststart", "-y", base]);
    const metadata = await probeVideo(base, "mp4");
    const expected = items.reduce((sum, item) => sum + (item.mediaType === "IMAGE" ? item.plannedDuration : (item.trimEnd ?? item.sourceDuration) - (item.trimStart ?? 0)), 0);
    if (Math.abs(metadata.duration - expected) > Math.max(0.5, expected * 0.1)) throw new WorkflowError("FINAL_VIDEO_DURATION_MISMATCH", "生成成片的时长校验失败，请重新生成。", 422);
    if (!storage.saveFinalVideo) throw new WorkflowError("STORAGE_UNAVAILABLE", "成片存储尚未就绪。", 503);
    const stored = await storage.saveFinalVideo(productionPlanId, finalVideoId, renderId, createReadStream(base));
    const settings = await db.videoRenderSettings.findUnique({ where: { productionPlanId }, include: { bgmTrack: true } });
    const transcript = await subtitlesForProduction(productionPlanId, finalVideoId, base, metadata.duration, work, settings?.subtitleEnabled ?? true);
    const enhanced = path.join(work, "enhanced.mp4");
    const bgm = settings?.bgmEnabled && settings.bgmTrack ? (await storage.getLocalFile(settings.bgmTrack.storageKey)).path : null;
    await addEnhancements(base, enhanced, bgm, transcript.subtitles, settings?.originalAudioVolume ?? 1, settings?.bgmVolume ?? 0.14);
    const enhancedMetadata = await probeVideo(enhanced, "mp4"); const enhancedStored = await storage.saveFinalVideo(productionPlanId, finalVideoId, `${renderId}-enhanced`, createReadStream(enhanced)); const checks = await finalProgramChecks(enhanced);
    const snapshot: ProductionSnapshot = { productionPlanId: plan.id, timeline: items, subtitleEnabled: settings?.subtitleEnabled ?? true, bgmTrackId: bgm ? settings?.bgmTrackId ?? null : null, bgmVolume: settings?.bgmVolume ?? 0.14, originalAudioVolume: settings?.originalAudioVolume ?? 1, version: settings?.version ?? 1 };
    await db.$transaction(async (tx) => {
      const current = await tx.finalVideo.findFirst({ where: { id: finalVideoId, status: "RENDERING", renderToken } }); if (!current) throw new WorkflowError("RENDER_SUPERSEDED", "生成任务已被新的任务替代。", 409);
      await tx.finalVideo.update({ where: { id: finalVideoId }, data: { status: "READY", fileUrl: enhancedStored.url, storageKey: enhancedStored.key, baseFileUrl: stored.url, baseStorageKey: stored.key, baseDuration: metadata.duration, enhancedFileUrl: enhancedStored.url, enhancedStorageKey: enhancedStored.key, enhancedDuration: enhancedMetadata.duration, enhancedFileSize: enhancedStored.size, duration: enhancedMetadata.duration, width: enhancedMetadata.width, height: enhancedMetadata.height, fps: enhancedMetadata.fps, codec: enhancedMetadata.codec, fileSize: enhancedStored.size, sourceSnapshot: snapshot, renderDurationMs: Date.now() - started, errorMessage: null, renderToken: null } });
      const issues = [...(checks.blackScreen ? ["BLACK_SCREEN"] : []), ...(!checks.audio ? ["AUDIO_MISSING"] : [])];
      await tx.finalVideoQA.upsert({ where: { finalVideoId }, create: { finalVideoId, status: issues.length ? "ISSUES" : "PASSED", passed: !issues.length, criticalIssues: issues, mainIssue: issues.length ? "检测到成片技术问题。" : null, confidence: 1, provider: "program", programChecks: JSON.parse(JSON.stringify(checks)) }, update: { status: issues.length ? "ISSUES" : "PASSED", passed: !issues.length, criticalIssues: issues, mainIssue: issues.length ? "检测到成片技术问题。" : null, confidence: 1, provider: "program", programChecks: JSON.parse(JSON.stringify(checks)), errorMessage: null } });
    });
    await recordProductEvent({ eventName: AnalyticsEvent.CONTENT_RENDER_COMPLETED, eventData: { productionPlanId, duration: enhancedMetadata.duration } }); await recordUsage({ operation: "FINAL_QA", provider: "program", durationMs: 0 });
    return { duration: enhancedMetadata.duration, sourceCount: items.length, subtitleStatus: transcript.status };
  } catch (error) {
    const current = await db.finalVideo.findFirst({ where: { id: finalVideoId, renderToken } }); if (current) await db.finalVideo.update({ where: { id: finalVideoId }, data: { status: current.fileUrl ? "READY" : "FAILED", errorMessage: error instanceof Error ? error.message : "生成成片失败。", renderToken: null } });
    await recordProductEvent({ eventName: AnalyticsEvent.CONTENT_RENDER_FAILED, eventData: { productionPlanId } }); throw error;
  } finally { await rm(work, { recursive: true, force: true }); }
}


