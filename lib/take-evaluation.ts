import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { DEMO_USER_ID } from "./demo-user";
import { WorkflowError, publicError } from "./errors";
import { logEvent } from "./logger";
import { getStorageProvider } from "./storage";
import type { StorageProvider } from "./storage/storage-provider";
import { extractReferenceClip, probeVideo } from "./video";
import type { VideoExtension } from "./upload-rules";
import { applyEvaluationPolicy, deterministicTakeChecks } from "../packages/ai/evaluation-policy";
import { getTakeEvaluationConfig } from "../packages/ai/config";
import { getTakeEvaluationProvider } from "../packages/ai/get-video-ai-provider";
import type { TakeEvaluation } from "../packages/ai/types";
import type { VideoAIProvider } from "../packages/ai/video-ai-provider";
import { recordUsage } from "./analytics";

function storageKey(fileUrl: string) {
  const prefix = "/api/files/";
  if (!fileUrl.startsWith(prefix)) throw new WorkflowError("FILE_MISSING", "没有找到要检查的视频文件。", 404);
  return fileUrl.slice(prefix.length);
}

function extensionForMime(mimeType: string): VideoExtension {
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/webm") return "webm";
  throw new WorkflowError("UNSUPPORTED_FORMAT", "当前视频格式无法进行镜头检查。", 422);
}

async function ownedTake(projectId: string, takeId: string) {
  const take = await db.take.findFirst({
    where: { id: takeId, plannedShot: { shootingPlan: { projectId, project: { userId: DEMO_USER_ID } } } },
    include: {
      evaluation: true,
      plannedShot: {
        include: {
          referenceShot: true,
          shootingPlan: { include: { project: { include: { referenceVideo: true } } } },
        },
      },
    },
  });
  if (!take) throw new WorkflowError("TAKE_NOT_FOUND", "没有找到这条拍摄素材。", 404);
  if (!take.plannedShot || !take.plannedShotId) throw new WorkflowError("TAKE_NOT_FOUND", "这条视频不属于参考镜头拍摄流程。", 404);
  return take;
}

function primaryIssueCode(result: TakeEvaluation) {
  if (result.criticalIssues[0]) return result.criticalIssues[0];
  const scores = Object.entries(result.dimensions).sort((a, b) => a[1] - b[1]);
  return result.passed ? null : scores[0]?.[0].toUpperCase() || null;
}

async function referenceClip(input: {
  projectId: string;
  referenceShotId: string;
  startTime: number;
  endTime: number;
  referenceVideoUrl: string;
}, storage: StorageProvider, extractClip: typeof extractReferenceClip) {
  const key = `projects/${input.projectId}/shots/${input.referenceShotId}/reference-clip.mp4`;
  try { return await storage.getLocalFile(key); }
  catch {
    const source = await storage.getLocalFile(storageKey(input.referenceVideoUrl));
    await storage.saveReferenceClip(input.projectId, input.referenceShotId, await extractClip(source.path, input.startTime, input.endTime));
    return storage.getLocalFile(key);
  }
}

export type EvaluateTakeDependencies = {
  provider?: VideoAIProvider;
  storage?: StorageProvider;
  probe?: typeof probeVideo;
  extractClip?: typeof extractReferenceClip;
  providerConfig?: { provider: string; model: string | null };
};

export async function evaluateSavedTake(projectId: string, takeId: string, retry = false, dependencies: EvaluateTakeDependencies = {}) {
  let take = await ownedTake(projectId, takeId);
  const plannedShot = take.plannedShot;
  if (!plannedShot) throw new WorkflowError("TAKE_NOT_FOUND", "这条视频不属于参考镜头拍摄流程。", 404);
  if (!take.evaluation) {
    await db.evaluation.create({ data: { takeId, status: "PENDING" } });
    take = await ownedTake(projectId, takeId);
  }
  if (take.evaluation!.status === "EVALUATING") return { evaluation: take.evaluation, busy: true };
  if (!retry && ["PASSED", "NEEDS_RETAKE"].includes(take.evaluation!.status)) return { evaluation: take.evaluation, busy: false };

  const token = randomUUID();
  const claimed = await db.evaluation.updateMany({
    where: { takeId, status: { not: "EVALUATING" } },
    data: { status: "EVALUATING", evaluationToken: token, error: null },
  });
  if (!claimed.count) return { evaluation: (await ownedTake(projectId, takeId)).evaluation, busy: true };
  await db.take.update({ where: { id: takeId }, data: { status: "EVALUATING" } });

  const config = dependencies.providerConfig || (dependencies.provider ? { provider: "test", model: null } : getTakeEvaluationConfig());
  const started = Date.now();
  logEvent("take.evaluation_start", { projectId, plannedShotId: take.plannedShotId, takeId, ...config });
  try {
    const storage = dependencies.storage || getStorageProvider();
    const takeFile = await storage.getLocalFile(storageKey(take.videoUrl));
    const deterministicStarted = Date.now();
    const metadata = await (dependencies.probe || probeVideo)(takeFile.path, extensionForMime(take.mimeType));
    const referenceVideo = plannedShot.shootingPlan.project.referenceVideo;
    if (!referenceVideo) throw new WorkflowError("REFERENCE_MISSING", "项目参考视频不存在，暂时无法检查这条素材。", 409);
    const checks = deterministicTakeChecks({ take: metadata, targetDuration: plannedShot.targetDuration, referenceVideo });
    const clip = await referenceClip({
      projectId,
      referenceShotId: plannedShot.referenceShotId,
      startTime: plannedShot.referenceShot.startTime,
      endTime: plannedShot.referenceShot.endTime,
      referenceVideoUrl: referenceVideo.fileUrl,
    }, storage, dependencies.extractClip || extractReferenceClip);
    const deterministicMs = Date.now() - deterministicStarted;
    const providerStarted = Date.now();
    const modelResult = await (dependencies.provider || getTakeEvaluationProvider()).evaluateTake({
      referenceShot: {
        visualDescription: plannedShot.referenceShot.visualDescription,
        shotSize: plannedShot.referenceShot.shotSize,
        cameraMovement: plannedShot.referenceShot.cameraMovement,
        targetDuration: plannedShot.referenceShot.targetDuration,
      },
      plannedShot: {
        purpose: plannedShot.purpose,
        actionInstruction: plannedShot.actionInstruction,
        cameraInstruction: plannedShot.cameraInstruction,
        dialogue: plannedShot.dialogue,
        targetDuration: plannedShot.targetDuration,
      },
      take: {
        videoUrl: take.videoUrl,
        localFilePath: takeFile.path,
        mimeType: take.mimeType,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
      },
      referenceClip: { localFilePath: clip.path, mimeType: "video/mp4" },
      deterministicChecks: checks,
    });
    const aiMs = Date.now() - providerStarted;
    const result = applyEvaluationPolicy(modelResult);
    const status = result.passed ? "PASSED" as const : "NEEDS_RETAKE" as const;
    const totalMs = Date.now() - started;
    const rawResult = JSON.parse(JSON.stringify({ modelResult, deterministicChecks: checks, latency: { deterministicMs, aiMs, totalMs } }));
    const evaluation = await db.$transaction(async (tx) => {
      const updated = await tx.evaluation.update({ where: { takeId }, data: {
        status,
        passed: result.passed,
        score: result.overallScore,
        overallScore: result.overallScore,
        framingScore: result.dimensions.framing,
        actionScore: result.dimensions.action,
        movementScore: result.dimensions.movement,
        timingScore: result.dimensions.timing,
        visibilityScore: result.dimensions.visibility,
        criticalIssues: result.criticalIssues,
        mainIssueCode: primaryIssueCode(result),
        mainIssue: result.mainIssue,
        advice: result.advice,
        confidence: result.confidence,
        evidence: result.evidence,
        issueStartTime: result.issueStartTime,
        issueEndTime: result.issueEndTime,
        provider: config.provider,
        model: config.model,
        error: null,
        evaluationToken: null,
        evaluatedAt: new Date(),
        rawResult,
      } });
      await tx.take.update({ where: { id: takeId }, data: {
        status: result.passed ? "PASSED" : "REJECTED",
        acceptanceStatus: result.passed ? "AI_PASSED" : take.acceptanceStatus === "USER_ACCEPTED" ? "USER_ACCEPTED" : "NOT_ACCEPTED",
      } });
      if (result.passed) await tx.plannedShot.update({ where: { id: take.plannedShotId! }, data: { selectedTakeId: takeId, captureStatus: "CAPTURED" } });
      return updated;
    });
    logEvent("take.evaluation_success", { projectId, plannedShotId: take.plannedShotId, takeId, ...config, status, confidence: result.confidence, durationMs: totalMs, deterministicMs, aiMs });
    await recordUsage({ projectId, operation: "TAKE_EVALUATION", provider: config.provider, model: config.model, durationMs: totalMs });
    return { evaluation, busy: false };
  } catch (error) {
    const failure = publicError(error);
    await db.$transaction([
      db.evaluation.updateMany({ where: { takeId, evaluationToken: token }, data: { status: "FAILED", evaluationToken: null, error: failure.error, evaluatedAt: new Date() } }),
      db.take.update({ where: { id: takeId }, data: { status: "UPLOADED" } }),
    ]);
    logEvent("take.evaluation_fail", { projectId, plannedShotId: take.plannedShotId, takeId, ...config, durationMs: Date.now() - started, error });
    throw error;
  }
}

export async function acceptTakeDespiteEvaluation(projectId: string, takeId: string) {
  const take = await ownedTake(projectId, takeId);
  if (take.evaluation?.status === "EVALUATING") throw new WorkflowError("EVALUATION_BUSY", "这条素材仍在检查中，请稍候。", 409);
  await db.$transaction([
    db.take.update({ where: { id: takeId }, data: { acceptanceStatus: "USER_ACCEPTED" } }),
    db.plannedShot.update({ where: { id: take.plannedShotId! }, data: { selectedTakeId: takeId, captureStatus: "CAPTURED" } }),
  ]);
  return { takeId, acceptanceStatus: "USER_ACCEPTED" as const, selectedTakeId: takeId };
}
