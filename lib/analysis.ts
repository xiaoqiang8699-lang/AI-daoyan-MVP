import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { DEMO_USER_ID } from "./demo-user";
import { WorkflowError, publicError } from "./errors";
import { logEvent } from "./logger";
import { getStorageProvider } from "./storage";
import type { StorageProvider } from "./storage/storage-provider";
import { extractReferenceFrame } from "./video";
import { getVideoAIProvider } from "../packages/ai/get-video-ai-provider";
import { getVideoAIConfig } from "../packages/ai/config";
import { validateShotPlans } from "../packages/ai/shot-schema";
import type { VideoAIProvider } from "../packages/ai/video-ai-provider";
import type { ShotPlan } from "../packages/ai/types";
import type { AnalysisState } from "./analysis-state";
import { recordProductEvent, recordUsage } from "./analytics";
import { AnalyticsEvent } from "./analytics-events";

const ANALYSIS_LEASE_MS = 15 * 60_000;

export async function getAnalysisState(projectId: string): Promise<AnalysisState> {
  await db.project.updateMany({
    where: { id: projectId, userId: DEMO_USER_ID, status: "ANALYZING", analysisToken: { not: null }, analysisStartedAt: { lt: new Date(Date.now() - ANALYSIS_LEASE_MS) } },
    data: { status: "ANALYSIS_FAILED", analysisToken: null, analysisError: "分析耗时过长或已中断，请重新分析。" },
  });
  const project = await db.project.findFirst({ where: { id: projectId, userId: DEMO_USER_ID }, include: { _count: { select: { shots: true } } } });
  if (!project) throw new WorkflowError("NOT_FOUND", "没有找到这个项目。", 404);
  return { status: project.status, error: project.analysisError, shotCount: project._count.shots, provider: project.analysisProvider };
}

export async function analyzeProject(projectId: string, retry = false, dependencies: {
  provider?: VideoAIProvider;
  storage?: StorageProvider;
  extractFrame?: typeof extractReferenceFrame;
} = {}): Promise<AnalysisState> {
  const current = await getAnalysisState(projectId);
  if (current.status === "READY_TO_SHOOT" && !retry) return current;
  if (current.status === "SHOOTING" || current.status === "COMPLETED") throw new WorkflowError("PROJECT_IN_USE", "项目已经开始拍摄，不能替换拍摄计划。", 409);
  const token = randomUUID();
  const started = Date.now();
  const claim = await db.project.updateMany({
    where: { id: projectId, userId: DEMO_USER_ID, analysisToken: null, status: { in: ["DRAFT", "ANALYZING", "ANALYSIS_FAILED", "READY_TO_SHOOT"] } },
    data: { status: "ANALYZING", analysisToken: token, analysisStartedAt: new Date(), analysisError: null },
  });
  if (claim.count === 0) return getAnalysisState(projectId);
  await recordProductEvent({ eventName: AnalyticsEvent.REFERENCE_ANALYSIS_STARTED, projectId });
  const storage = dependencies.storage || getStorageProvider();
  const newFrameKeys: string[] = [];
  const context: Record<string, unknown> = { projectId, provider: null, model: null, referenceVideoId: null };
  let committed = false;
  try {
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { referenceVideo: true } });
    const reference = project.referenceVideo;
    if (!reference?.storageKey || !reference.mimeType) throw new WorkflowError("REFERENCE_MISSING", "这个项目还没有真实参考视频，请创建项目并上传视频。", 422);
    Object.assign(context, { referenceVideoId: reference.id }, dependencies.provider ? { provider: "test" } : getVideoAIConfig());
    logEvent("analysis.start", context);
    const file = await storage.getLocalFile(reference.storageKey);
    const provider = dependencies.provider || getVideoAIProvider();
    const plans = validateShotPlans(await provider.analyzeReferenceVideo({ fileUrl: reference.fileUrl, duration: reference.duration, localFilePath: file.path, mimeType: reference.mimeType }), reference.duration);
    const shots: Array<ShotPlan & { id: string; projectId: string; referenceFrameUrl: string; status: "READY" }> = [];
    for (const plan of plans) {
      const shotId = randomUUID();
      const time = Math.min(plan.startTime + Math.min(0.1, (plan.endTime - plan.startTime) / 2), Math.max(0, reference.duration - 0.05));
      const frame = await storage.saveReferenceFrame(projectId, shotId, await (dependencies.extractFrame || extractReferenceFrame)(file.path, time));
      newFrameKeys.push(frame.key);
      shots.push({ ...plan, dialogue: plan.dialogue || null, id: shotId, projectId, referenceFrameUrl: frame.url, status: "READY" as const });
    }
    const oldFrames = await db.$transaction(async (tx) => {
      // Lock ownership is checked in the same transaction as replacement.
      const finished = await tx.project.updateMany({ where: { id: projectId, analysisToken: token, status: "ANALYZING" }, data: { status: "READY_TO_SHOOT", analysisToken: null, analysisError: null, analysisProvider: String(context.provider) } });
      if (finished.count !== 1) throw new WorkflowError("ANALYSIS_EXPIRED", "本次分析已中断，请重新分析。", 409);
      const previous = await tx.shot.findMany({ where: { projectId }, select: { referenceFrameUrl: true } });
      await tx.shot.deleteMany({ where: { projectId } });
      await tx.shot.createMany({ data: shots });
      return previous;
    });
    committed = true;
    for (const frame of oldFrames) {
      if (frame.referenceFrameUrl?.startsWith("/api/files/")) {
        try { await storage.deleteFile(frame.referenceFrameUrl.slice("/api/files/".length)); }
        catch (error) { logEvent("analysis.old_frame_cleanup_failed", { ...context, error }); }
      }
    }
    logEvent("analysis.success", { ...context, shotCount: shots.length, durationMs: Date.now() - started });
    await recordProductEvent({ eventName: AnalyticsEvent.REFERENCE_ANALYSIS_COMPLETED, projectId, eventData: { shotCount: shots.length } });
    await recordUsage({ projectId, operation: "REFERENCE_ANALYSIS", provider: String(context.provider || "unknown"), model: context.model ? String(context.model) : null, durationMs: Date.now() - started });
  } catch (error) {
    const message = publicError(error).error;
    logEvent("analysis.fail", { ...context, durationMs: Date.now() - started, error });
    await db.project.updateMany({ where: { id: projectId, analysisToken: token }, data: { status: "ANALYSIS_FAILED", analysisToken: null, analysisError: message } });
    await recordProductEvent({ eventName: AnalyticsEvent.REFERENCE_ANALYSIS_FAILED, projectId });
  } finally {
    if (!committed) {
      for (const key of newFrameKeys) {
        try { await storage.deleteFile(key); }
        catch (error) { logEvent("analysis.new_frame_cleanup_failed", { ...context, error }); }
      }
    }
  }
  return getAnalysisState(projectId);
}
