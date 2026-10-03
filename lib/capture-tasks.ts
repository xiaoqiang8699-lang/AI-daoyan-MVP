import "server-only";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { db } from "./db";
import { DEMO_USER_ID } from "./demo-user";
import { WorkflowError } from "./errors";
import { getStorageProvider } from "./storage";
import type { StorageProvider } from "./storage/storage-provider";
import { VIDEO_TYPES, validateTakeVideoFile } from "./upload-rules";
import { probeVideo } from "./video";
import { validateTakeMetadata } from "./takes";
import { refreshProductionStatus } from "./production";
import { applyEvaluationPolicy } from "../packages/ai/evaluation-policy";
import { getTakeEvaluationConfig } from "../packages/ai/config";
import { getTakeEvaluationProvider } from "../packages/ai/get-video-ai-provider";
import type { VideoAIProvider } from "../packages/ai/video-ai-provider";

async function taskForUser(productionId: string, taskId: string) {
  const task = await db.captureTask.findFirst({ where: { id: taskId, productionPlanId: productionId, productionPlan: { opportunity: { batch: { userId: DEMO_USER_ID } } } }, include: { productionPlan: true } });
  if (!task) throw new WorkflowError("CAPTURE_TASK_NOT_FOUND", "找不到这项补拍任务。", 404);
  return task;
}

export async function saveCaptureTaskTake(input: { productionId: string; captureTaskId: string; fileName: string; size: number; mimeType: string; source: Readable }, dependencies: { storage?: StorageProvider; probe?: typeof probeVideo } = {}) {
  const task = await taskForUser(input.productionId, input.captureTaskId);
  const extension = validateTakeVideoFile(input.fileName, input.size, input.mimeType);
  const takeId = randomUUID(); const storage = dependencies.storage || getStorageProvider(); let key: string | undefined;
  try {
    const stored = await storage.saveTake(input.productionId, input.captureTaskId, takeId, extension, input.source); key = stored.key;
    if (stored.size !== input.size) throw new WorkflowError("INCOMPLETE_UPLOAD", "视频上传不完整，请重试。", 400);
    const file = await storage.getLocalFile(stored.key); const metadata = validateTakeMetadata(await (dependencies.probe || probeVideo)(file.path, extension));
    const take = await db.$transaction(async (tx) => {
      const created = await tx.take.create({ data: { id: takeId, captureTaskId: task.id, videoUrl: stored.url, duration: metadata.duration, width: metadata.width, height: metadata.height, mimeType: VIDEO_TYPES[extension], fileSize: stored.size, evaluation: { create: { status: "PENDING" } } }, include: { evaluation: true } });
      await tx.captureTask.update({ where: { id: task.id }, data: { status: "CAPTURED" } }); return created;
    });
    return { take, production: await refreshProductionStatus(input.productionId) };
  } catch (error) { if (key) await storage.deleteFile(key).catch(() => {}); throw error; }
}

export async function skipCaptureTask(productionId: string, taskId: string) { const task = await taskForUser(productionId, taskId); if (task.selectedTakeId) throw new WorkflowError("TASK_ALREADY_CAPTURED", "这项补拍已有采用的视频。", 409); await db.captureTask.update({ where: { id: task.id }, data: { status: "SKIPPED" } }); return { status: "SKIPPED" as const }; }

export async function evaluateCaptureTaskTake(productionId: string, taskId: string, takeId: string, provider: VideoAIProvider = getTakeEvaluationProvider()) {
  const task = await db.captureTask.findFirst({ where: { id: taskId, productionPlanId: productionId, takes: { some: { id: takeId } }, productionPlan: { opportunity: { batch: { userId: DEMO_USER_ID } } } }, include: { takes: { where: { id: takeId }, include: { evaluation: true } } } });
  if (!task) throw new WorkflowError("TAKE_NOT_FOUND", "找不到这条补拍视频。", 404); const take = task.takes[0]; if (!take) throw new WorkflowError("TAKE_NOT_FOUND", "找不到这条补拍视频。", 404);
  if (!provider.evaluateTaskOnly) throw new WorkflowError("TASK_ONLY_UNSUPPORTED", "当前 AI 检查服务暂不支持补拍任务检查。", 503);
  const storage = getStorageProvider(); const file = await storage.getLocalFile(take.videoUrl.slice("/api/files/".length)); const metadata = validateTakeMetadata(await probeVideo(file.path, take.mimeType === "video/mp4" ? "mp4" : take.mimeType === "video/webm" ? "webm" : "mov"));
  const ratio = metadata.duration / task.targetDuration; const checks = { fileValid: true, takeDuration: metadata.duration, targetDuration: task.targetDuration, durationRatio: ratio, takeOrientation: metadata.width > metadata.height ? "LANDSCAPE" as const : metadata.width === metadata.height ? "SQUARE" as const : "PORTRAIT" as const, warnings: ratio < 0.6 || ratio > 1.8 ? ["DURATION_OUT_OF_RANGE" as const] : [] };
  await db.evaluation.update({ where: { takeId }, data: { status: "EVALUATING", error: null } }); await db.take.update({ where: { id: takeId }, data: { status: "EVALUATING" } });
  try { const model = await provider.evaluateTaskOnly({ captureTask: { purpose: task.purpose, actionInstruction: task.actionInstruction, cameraInstruction: task.cameraInstruction, targetDuration: task.targetDuration }, take: { videoUrl: take.videoUrl, localFilePath: file.path, mimeType: take.mimeType, duration: metadata.duration, width: metadata.width, height: metadata.height }, deterministicChecks: checks }); const result = applyEvaluationPolicy(model); const status = result.passed ? "PASSED" as const : "NEEDS_RETAKE" as const; const config = getTakeEvaluationConfig(); const evaluation = await db.$transaction(async (tx) => { const saved = await tx.evaluation.update({ where: { takeId }, data: { status, passed: result.passed, overallScore: result.overallScore, score: result.overallScore, framingScore: result.dimensions.framing, actionScore: result.dimensions.action, movementScore: result.dimensions.movement, timingScore: result.dimensions.timing, visibilityScore: result.dimensions.visibility, criticalIssues: result.criticalIssues, mainIssue: result.mainIssue, advice: result.advice, confidence: result.confidence, evidence: result.evidence, provider: config.provider, model: config.model, evaluatedAt: new Date() } }); await tx.take.update({ where: { id: takeId }, data: { status: result.passed ? "PASSED" : "REJECTED", acceptanceStatus: result.passed ? "AI_PASSED" : "NOT_ACCEPTED" } }); if (result.passed) await tx.captureTask.update({ where: { id: task.id }, data: { selectedTakeId: takeId, status: "CAPTURED" } }); return saved; }); await db.finalVideo.updateMany({ where: { productionPlanId: productionId, status: "READY" }, data: { status: "OUTDATED" } }); await refreshProductionStatus(productionId); return { evaluation, status }; } catch (error) { await db.$transaction([db.evaluation.update({ where: { takeId }, data: { status: "FAILED", error: "检查失败" } }), db.take.update({ where: { id: takeId }, data: { status: "UPLOADED" } })]); throw error; }
}

export async function acceptCaptureTaskTake(productionId: string, taskId: string, takeId: string) { const task = await taskForUser(productionId, taskId); const take = await db.take.findFirst({ where: { id: takeId, captureTaskId: task.id } }); if (!take) throw new WorkflowError("TAKE_NOT_FOUND", "找不到这条补拍视频。", 404); await db.$transaction([db.take.update({ where: { id: takeId }, data: { acceptanceStatus: "USER_ACCEPTED" } }), db.captureTask.update({ where: { id: task.id }, data: { selectedTakeId: takeId, status: "CAPTURED" } })]); await db.finalVideo.updateMany({ where: { productionPlanId: productionId, status: "READY" }, data: { status: "OUTDATED" } }); await refreshProductionStatus(productionId); return { selectedTakeId: takeId }; }
