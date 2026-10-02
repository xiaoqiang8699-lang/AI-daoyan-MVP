import "server-only";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { WorkflowError } from "@/lib/errors";
import { getStorageProvider } from "@/lib/storage";
import { ffmpegBinary, hasAudioStream, probeVideo, runVideoCommand } from "@/lib/video";
import { finalProgramChecks, validateTranscript, writeAss } from "@/lib/enhancement";
import { getSpeechToTextProvider } from "@/lib/enhancement-providers";
import { recordProductEvent, recordUsage } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";
import { completeTestSession } from "@/lib/test-sessions";

export type FinalSource = { plannedShotId: string; takeId: string; order: number; trimDecisionId?: string | null; trimStart?: number; trimEnd?: number };
type RenderSnapshot = { shots: FinalSource[]; subtitleEnabled: boolean; bgmTrackId: string | null; bgmVolume: number; originalAudioVolume: number; version: number };
export const TRIM_POLICY = { minimumConfidence: 0.55, maximumDurationRatio: 1.4 };

export function safeTrim(input: { duration: number; targetDuration: number; dialogue: string | null; trim?: { id: string; startTime: number; endTime: number; confidence: number | null } | null }) {
  const full = { source: "FULL_TAKE" as const, startTime: 0, endTime: input.duration, id: null };
  const trim = input.trim;
  if (!trim || trim.confidence === null || trim.confidence < TRIM_POLICY.minimumConfidence || trim.startTime < 0 || trim.endTime <= trim.startTime || trim.endTime > input.duration) return full;
  const duration = trim.endTime - trim.startTime;
  const minimum = Math.min(input.targetDuration * 0.6, 1);
  if (duration < minimum || (!input.dialogue && duration > input.targetDuration * TRIM_POLICY.maximumDurationRatio)) return full;
  return { source: "AUTO" as const, startTime: trim.startTime, endTime: trim.endTime, id: trim.id };
}

export function missingSelectedShots(shots: Array<{ id: string; order: number; selectedTakeId: string | null }>) {
  return shots.filter((shot) => !shot.selectedTakeId).map((shot) => ({ id: shot.id, order: shot.order }));
}

export function sourcesOutdated(snapshot: unknown, sources: FinalSource[], settings?: Omit<RenderSnapshot, "shots">) {
  const value: Partial<RenderSnapshot> | null = Array.isArray(snapshot) ? { shots: snapshot } : snapshot as Partial<RenderSnapshot> | null;
  if (!value || !Array.isArray(value.shots) || value.shots.length !== sources.length) return true;
  const shotsOutdated = value.shots.some((item, index) => !item || typeof item !== "object" || (item as FinalSource).plannedShotId !== sources[index].plannedShotId || (item as FinalSource).takeId !== sources[index].takeId || (item as FinalSource).order !== sources[index].order || (item as FinalSource).trimDecisionId !== sources[index].trimDecisionId || (item as FinalSource).trimStart !== sources[index].trimStart || (item as FinalSource).trimEnd !== sources[index].trimEnd);
  return shotsOutdated || !!settings && (value.subtitleEnabled !== settings.subtitleEnabled || value.bgmTrackId !== settings.bgmTrackId || value.bgmVolume !== settings.bgmVolume || value.originalAudioVolume !== settings.originalAudioVolume || value.version !== settings.version);
}

function storageKeyFromUrl(url: string) {
  const prefix = "/api/files/";
  if (!url.startsWith(prefix)) throw new WorkflowError("FILE_MISSING", "选中的素材地址无效。", 422);
  return url.slice(prefix.length);
}

async function projectForRender(projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId: DEMO_USER_ID },
    include: {
      referenceVideo: true,
      shootingPlan: { include: { shots: { orderBy: { order: "asc" }, include: { selectedTake: { include: { trimDecision: true } } } } } },
      finalVideo: { include: { subtitleTrack: true, finalQa: true } },
      renderSettings: { include: { bgmTrack: true } },
    },
  });
  if (!project?.shootingPlan || !project.referenceVideo) throw new WorkflowError("PROJECT_NOT_READY", "拍摄方案或参考视频尚未准备好。", 422);
  return project;
}

export async function getFinalVideoView(projectId: string) {
  const project = await projectForRender(projectId);
  const shots = project.shootingPlan!.shots;
  const missing = missingSelectedShots(shots);
  const sources = shots.filter((shot): shot is typeof shot & { selectedTakeId: string; selectedTake: NonNullable<typeof shot.selectedTake> } => !!shot.selectedTakeId && !!shot.selectedTake).map((shot) => {
    const trim = safeTrim({ duration: shot.selectedTake.duration, targetDuration: shot.targetDuration, dialogue: shot.dialogue, trim: shot.selectedTake.trimDecision });
    return { plannedShotId: shot.id, takeId: shot.selectedTakeId, order: shot.order, trimDecisionId: trim.id, trimStart: trim.startTime, trimEnd: trim.endTime };
  });
  const finalVideo = project.finalVideo;
  const settings = project.renderSettings || { subtitleEnabled: true, bgmEnabled: false, bgmTrackId: null, bgmVolume: 0.14, originalAudioVolume: 1, version: 1 };
  return {
    projectName: project.name,
    eligible: missing.length === 0 && shots.length > 0,
    missing,
    sourceCount: sources.length,
    finalVideo: finalVideo ? {
      status: finalVideo.status,
      fileUrl: finalVideo.enhancedFileUrl || finalVideo.fileUrl,
      baseFileUrl: finalVideo.baseFileUrl || finalVideo.fileUrl,
      duration: finalVideo.duration,
      width: finalVideo.width,
      height: finalVideo.height,
      fileSize: finalVideo.fileSize,
      renderDurationMs: finalVideo.renderDurationMs,
      errorMessage: finalVideo.errorMessage,
      subtitleStatus: finalVideo.subtitleTrack?.status || null,
      qaStatus: finalVideo.finalQa?.status || null,
      settings: { subtitleEnabled: settings.subtitleEnabled, bgmEnabled: settings.bgmEnabled, bgmTrackId: settings.bgmTrackId, bgmVolume: settings.bgmVolume },
      outdated: finalVideo.status === "READY" && sourcesOutdated(finalVideo.sourceSnapshot, sources, { subtitleEnabled: settings.subtitleEnabled, bgmTrackId: settings.bgmEnabled ? settings.bgmTrackId : null, bgmVolume: settings.bgmVolume, originalAudioVolume: settings.originalAudioVolume, version: settings.version }),
    } : null,
  };
}

export async function reserveFinalRender(projectId: string) {
  const view = await getFinalVideoView(projectId);
  if (!view.eligible) throw new WorkflowError("FINAL_VIDEO_INCOMPLETE", `还有 ${view.missing.length} 个镜头没有可用素材。`, 422, { cause: view.missing });
  const existing = await db.finalVideo.upsert({ where: { projectId }, create: { projectId, status: "PENDING" }, update: {} });
  const token = randomUUID();
  const updated = await db.finalVideo.updateMany({ where: { id: existing.id, status: { not: "RENDERING" } }, data: { status: "RENDERING", errorMessage: null, renderToken: token } });
  if (!updated.count) return { busy: true as const, finalVideoId: existing.id };
  return { busy: false as const, finalVideoId: existing.id, renderToken: token };
}

function targetCanvas(width: number, height: number) { return height > width ? { width: 720, height: 1280 } : { width: 1280, height: 720 }; }

function ffconcatPath(value: string) { return value.replace(/\\/g, "/").replace(/'/g, "'\\''"); }

async function normalizeSegment(input: string, output: string, canvas: { width: number; height: number }, audio: boolean, startTime: number, duration: number) {
  const filter = `[0:v]fps=30,scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=increase,crop=${canvas.width}:${canvas.height},boxblur=20:10[bg];[0:v]fps=30,scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h),format=yuv420p[v]`;
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-ss", startTime.toFixed(3), "-i", input, "-t", duration.toFixed(3)];
  if (!audio) args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  args.push("-filter_complex", filter, "-map", "[v]", "-map", audio ? "0:a:0" : "1:a:0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart", output);
  await runVideoCommand(ffmpegBinary(), args, 300_000);
}

function subtitleFilter(filePath: string) {
  return `subtitles=filename='${filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'")}'`;
}

async function addEnhancements(base: string, output: string, bgm: string | null, subtitles: string | null, originalVolume: number, bgmVolume: number) {
  if (!bgm && !subtitles) return copyFile(base, output);
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  if (bgm) args.push("-stream_loop", "-1", "-i", bgm);
  args.push("-i", base);
  const baseIndex = bgm ? 1 : 0;
  if (bgm) args.push("-filter_complex", `[0:a]volume=${bgmVolume},afade=t=in:st=0:d=0.4,afade=t=out:st=0:d=0.7[bgm];[${baseIndex}:a]volume=${originalVolume}[voice];[voice][bgm]amix=inputs=2:duration=first:dropout_transition=0[a]`);
  if (subtitles) args.push("-vf", subtitleFilter(subtitles));
  args.push("-map", `${baseIndex}:v:0`, "-map", bgm ? "[a]" : `${baseIndex}:a:0`, "-c:v", subtitles ? "libx264" : "copy");
  if (subtitles) args.push("-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p");
  args.push("-c:a", "aac", "-movflags", "+faststart", output);
  await runVideoCommand(ffmpegBinary(), args, 300_000);
}

async function transcribeFinal(projectId: string, finalVideoId: string, rendered: string, duration: number, work: string, enabled: boolean) {
  if (!enabled) return { subtitles: null as string | null, status: "NO_SPEECH" as const };
  const { provider, config } = getSpeechToTextProvider();
  await db.subtitleTrack.upsert({ where: { finalVideoId }, create: { projectId, finalVideoId, status: "TRANSCRIBING", provider: config.provider, model: config.model }, update: { status: "TRANSCRIBING", provider: config.provider, model: config.model, errorMessage: null } });
  const audio = path.join(work, "final-audio.mp3");
  try {
    await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", "-i", rendered, "-map", "0:a:0", "-vn", "-c:a", "libmp3lame", "-b:a", "96k", audio], 120_000);
    const started = Date.now();
    const transcript = await provider.transcribe({ localFilePath: audio, mimeType: "audio/mpeg", duration });
    const segments = validateTranscript(transcript.segments, duration);
    const status = segments.length ? "READY" : "NO_SPEECH";
    await db.subtitleTrack.update({ where: { finalVideoId }, data: { status, language: transcript.language, segments: JSON.parse(JSON.stringify(segments)), provider: config.provider, model: config.model, transcriptionDurationMs: Date.now() - started, errorMessage: null } });
    await recordProductEvent({ eventName: AnalyticsEvent.SUBTITLE_GENERATED, projectId, eventData: { hasSpeech: segments.length > 0 } });
    await recordUsage({ projectId, operation: "SPEECH_TO_TEXT", provider: config.provider, model: config.model, durationMs: Date.now() - started, currencyCost: config.provider === "local" ? 0 : null });
    if (!segments.length) return { subtitles: null, status };
    const subtitles = path.join(work, "captions.ass");
    const metadata = await probeVideo(rendered, "mp4");
    await writeAss(subtitles, segments, metadata.width, metadata.height);
    return { subtitles, status };
  } catch (error) {
    await db.subtitleTrack.update({ where: { finalVideoId }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "字幕转写失败。" } });
    return { subtitles: null, status: "FAILED" as const };
  }
}

export async function renderFinalVideo(projectId: string, finalVideoId: string, renderToken: string) {
  const finalVideo = await db.finalVideo.findFirst({ where: { id: finalVideoId, projectId, status: "RENDERING", renderToken } });
  if (!finalVideo) return { skipped: true };
  const oldKey = finalVideo.storageKey;
  const renderId = randomUUID();
  const started = Date.now();
  const work = path.resolve(process.env.STORAGE_ROOT || "storage", "tmp", "renders", renderId);
  try {
    const project = await projectForRender(projectId);
    const shots = project.shootingPlan!.shots;
    const missing = missingSelectedShots(shots);
    if (missing.length) throw new WorkflowError("FINAL_VIDEO_INCOMPLETE", `还有 ${missing.length} 个镜头没有可用素材。`, 422);
    const canvas = targetCanvas(project.referenceVideo!.width || 1280, project.referenceVideo!.height || 720);
    const storage = getStorageProvider();
    await mkdir(work, { recursive: true });
    const segments: string[] = [];
    const snapshot: FinalSource[] = [];
    const accounting: Array<Record<string, number>> = [];
    for (const shot of shots) {
      if (!shot.selectedTake || !shot.selectedTakeId) throw new WorkflowError("FINAL_VIDEO_INCOMPLETE", "存在没有可用素材的镜头。", 422);
      const local = await storage.getLocalFile(storageKeyFromUrl(shot.selectedTake.videoUrl));
      const segment = path.join(work, `segment-${String(shot.order).padStart(3, "0")}.mp4`);
      const trim = safeTrim({ duration: shot.selectedTake.duration, targetDuration: shot.targetDuration, dialogue: shot.dialogue, trim: shot.selectedTake.trimDecision });
      await normalizeSegment(local.path, segment, canvas, await hasAudioStream(local.path), trim.startTime, trim.endTime - trim.startTime);
      segments.push(segment);
      const actual = await probeVideo(segment, "mp4");
      snapshot.push({ plannedShotId: shot.id, takeId: shot.selectedTakeId, order: shot.order, trimDecisionId: trim.id, trimStart: trim.startTime, trimEnd: trim.endTime });
      accounting.push({ order: shot.order, takeDuration: shot.selectedTake.duration, trimStart: trim.startTime, trimEnd: trim.endTime, expectedSegmentDuration: trim.endTime - trim.startTime, actualSegmentDuration: actual.duration });
    }
    const list = path.join(work, "concat.txt");
    await writeFile(list, segments.map((segment) => `file '${ffconcatPath(segment)}'`).join("\n"), "utf8");
    const rendered = path.join(work, "final.mp4");
    await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", rendered], 300_000);
    const metadata = await probeVideo(rendered, "mp4");
    if (metadata.width !== canvas.width || metadata.height !== canvas.height || metadata.duration <= 0 || metadata.codec !== "h264" || !(await hasAudioStream(rendered))) throw new WorkflowError("FINAL_VIDEO_INVALID", "生成的视频未通过校验，请重新生成。", 422);
    const expectedFinalDuration = accounting.reduce((sum, item) => sum + item.expectedSegmentDuration, 0);
    const durationTolerance = Math.max(0.3, expectedFinalDuration * 0.01);
    if (Math.abs(metadata.duration - expectedFinalDuration) > durationTolerance) throw new WorkflowError("FINAL_VIDEO_DURATION_MISMATCH", "生成成片的时长校验失败，请重新生成。", 422);
    if (!storage.saveFinalVideo) throw new WorkflowError("STORAGE_UNAVAILABLE", "成片存储尚未就绪。", 503);
    await writeFile(path.join(work, "render-manifest.json"), JSON.stringify({ renderId, segments: accounting, expectedFinalDuration, actualFinalDuration: metadata.duration, durationTolerance }, null, 2));
    const stored = await storage.saveFinalVideo(projectId, finalVideoId, renderId, createReadStream(rendered));
    const settings = project.renderSettings || { subtitleEnabled: true, bgmEnabled: false, bgmTrackId: null, bgmVolume: 0.14, originalAudioVolume: 1, version: 1 };
    const transcript = await transcribeFinal(projectId, finalVideoId, rendered, metadata.duration, work, settings.subtitleEnabled);
    const enhanced = path.join(work, "enhanced.mp4");
    const bgm = settings.bgmEnabled && project.renderSettings?.bgmTrack ? (await storage.getLocalFile(project.renderSettings.bgmTrack.storageKey)).path : null;
    await addEnhancements(rendered, enhanced, bgm, transcript.subtitles, settings.originalAudioVolume, settings.bgmVolume);
    const enhancedMetadata = await probeVideo(enhanced, "mp4");
    const checks = await finalProgramChecks(enhanced);
    const enhancedStored = await storage.saveFinalVideo(projectId, finalVideoId, `${renderId}-enhanced`, createReadStream(enhanced));
    const renderSnapshot: RenderSnapshot = { shots: snapshot, subtitleEnabled: settings.subtitleEnabled, bgmTrackId: settings.bgmEnabled ? settings.bgmTrackId : null, bgmVolume: settings.bgmVolume, originalAudioVolume: settings.originalAudioVolume, version: settings.version };
    await db.$transaction(async (tx) => {
      const current = await tx.finalVideo.findFirst({ where: { id: finalVideoId, status: "RENDERING", renderToken } });
      if (!current) throw new WorkflowError("RENDER_SUPERSEDED", "生成任务已被新的任务替代。", 409);
      await tx.finalVideo.update({ where: { id: finalVideoId }, data: { status: "READY", fileUrl: enhancedStored.url, storageKey: enhancedStored.key, baseFileUrl: stored.url, baseStorageKey: stored.key, baseDuration: metadata.duration, enhancedFileUrl: enhancedStored.url, enhancedStorageKey: enhancedStored.key, enhancedDuration: enhancedMetadata.duration, enhancedFileSize: enhancedStored.size, duration: enhancedMetadata.duration, width: enhancedMetadata.width, height: enhancedMetadata.height, fps: enhancedMetadata.fps, codec: enhancedMetadata.codec, fileSize: enhancedStored.size, sourceSnapshot: renderSnapshot, renderDurationMs: Date.now() - started, errorMessage: null, renderToken: null } });
      const issues = [...(checks.blackScreen ? ["BLACK_SCREEN"] : []), ...(!checks.audio ? ["AUDIO_MISSING"] : [])];
      const programChecks = JSON.parse(JSON.stringify(checks));
      await tx.finalVideoQA.upsert({ where: { finalVideoId }, create: { finalVideoId, status: issues.length ? "ISSUES" : "PASSED", passed: !issues.length, criticalIssues: issues, mainIssue: issues.length ? "检测到成片技术问题。" : null, confidence: 1, provider: "program", programChecks }, update: { status: issues.length ? "ISSUES" : "PASSED", passed: !issues.length, criticalIssues: issues, mainIssue: issues.length ? "检测到成片技术问题。" : null, advice: issues.length ? "重新生成成片后再检查。" : null, confidence: 1, provider: "program", programChecks, errorMessage: null } });
    });
    await recordProductEvent({ eventName: AnalyticsEvent.FINAL_RENDER_COMPLETED, projectId, eventData: { duration: enhancedMetadata.duration } });
    await recordProductEvent({ eventName: AnalyticsEvent.FINAL_QA_COMPLETED, projectId });
    await recordUsage({ projectId, operation: "FINAL_QA", provider: "program", durationMs: 0, currencyCost: 0 });
    await completeTestSession(projectId);
    await recordProductEvent({ eventName: AnalyticsEvent.PROJECT_COMPLETED, projectId });
    return { skipped: false, duration: metadata.duration, fileSize: stored.size, sourceCount: snapshot.length };
  } catch (error) {
    const current = await db.finalVideo.findFirst({ where: { id: finalVideoId, renderToken } });
    if (current) await db.finalVideo.update({ where: { id: finalVideoId }, data: { status: oldKey ? "READY" : "FAILED", errorMessage: error instanceof Error ? error.message : "生成成片失败。", renderToken: null } });
    await recordProductEvent({ eventName: AnalyticsEvent.FINAL_RENDER_FAILED, projectId });
    throw error;
  } finally { await rm(work, { recursive: true, force: true }); }
}
