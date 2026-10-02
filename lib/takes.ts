import "server-only";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { db } from "./db";
import { DEMO_USER_ID } from "./demo-user";
import { WorkflowError } from "./errors";
import { getStorageProvider } from "./storage";
import type { StorageProvider } from "./storage/storage-provider";
import { VIDEO_TYPES, validateTakeVideoFile } from "./upload-rules";
import { probeVideo, type VideoMetadata } from "./video";

export const MAX_TAKE_DURATION = 30;

export type CaptureStatusValue = "NOT_STARTED" | "CAPTURED" | "SKIPPED";

export function calculateCaptureProgress(statuses: CaptureStatusValue[]) {
  return statuses.reduce((progress, status) => {
    progress.total += 1;
    if (status === "CAPTURED") progress.captured += 1;
    else if (status === "SKIPPED") progress.skipped += 1;
    else progress.notStarted += 1;
    return progress;
  }, { total: 0, captured: 0, skipped: 0, notStarted: 0 });
}

export function validateTakeMetadata(metadata: VideoMetadata) {
  if (metadata.duration > MAX_TAKE_DURATION + 0.05) {
    throw new WorkflowError("TAKE_TOO_LONG", "单镜视频最长 30 秒，请缩短后重试。", 422);
  }
  if (metadata.width < 1 || metadata.height < 1 || !metadata.codec) {
    throw new WorkflowError("INVALID_VIDEO", "没有读取到有效的视频画面。", 422);
  }
  return metadata;
}

async function ownedPlannedShot(projectId: string, plannedShotId: string) {
  const shot = await db.plannedShot.findFirst({
    where: { id: plannedShotId, shootingPlan: { projectId, project: { userId: DEMO_USER_ID } } },
    select: { id: true, captureStatus: true, selectedTakeId: true },
  });
  if (!shot) throw new WorkflowError("SHOT_NOT_FOUND", "没有找到这个计划镜头。", 404);
  return shot;
}

export async function saveTakeUpload(input: {
  projectId: string;
  plannedShotId: string;
  fileName: string;
  size: number;
  mimeType: string;
  source: Readable;
}, dependencies: {
  storage?: StorageProvider;
  probe?: typeof probeVideo;
} = {}) {
  await ownedPlannedShot(input.projectId, input.plannedShotId);
  if (input.fileName.length > 255) throw new WorkflowError("INVALID_FILE_NAME", "视频文件名过长，请缩短文件名。", 400);
  const extension = validateTakeVideoFile(input.fileName, input.size, input.mimeType);
  const takeId = randomUUID();
  const storage = dependencies.storage || getStorageProvider();
  let storageKey: string | undefined;
  try {
    const stored = await storage.saveTake(input.projectId, input.plannedShotId, takeId, extension, input.source);
    storageKey = stored.key;
    if (stored.size !== input.size) throw new WorkflowError("INCOMPLETE_UPLOAD", "视频上传不完整，请重新上传。", 400);
    const file = await storage.getLocalFile(stored.key);
    const metadata = validateTakeMetadata(await (dependencies.probe || probeVideo)(file.path, extension));
    const result = await db.$transaction(async (tx) => {
      const take = await tx.take.create({ data: {
        id: takeId,
        plannedShotId: input.plannedShotId,
        videoUrl: stored.url,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        mimeType: VIDEO_TYPES[extension],
        fileSize: stored.size,
        evaluation: { create: { status: "PENDING" } },
      }, include: { evaluation: true } });
      await tx.plannedShot.update({
        where: { id: input.plannedShotId },
        data: { captureStatus: "CAPTURED" },
      });
      await tx.project.updateMany({
        where: { id: input.projectId, status: "READY_TO_SHOOT" },
        data: { status: "SHOOTING" },
      });
      const statuses = await tx.plannedShot.findMany({
        where: { shootingPlan: { projectId: input.projectId } },
        select: { captureStatus: true },
      });
      return { take, progress: calculateCaptureProgress(statuses.map((item) => item.captureStatus)) };
    });
    return result;
  } catch (error) {
    if (storageKey) {
      try { await storage.deleteFile(storageKey); } catch { /* preserve the original validation or database error */ }
    }
    throw error;
  }
}

export async function skipPlannedShot(projectId: string, plannedShotId: string) {
  const shot = await ownedPlannedShot(projectId, plannedShotId);
  if (shot.captureStatus === "CAPTURED" || shot.selectedTakeId) {
    throw new WorkflowError("SHOT_ALREADY_CAPTURED", "这一镜已经拍过，当前视频仍会保留。", 409);
  }
  await db.plannedShot.update({ where: { id: plannedShotId }, data: { captureStatus: "SKIPPED" } });
  const statuses = await db.plannedShot.findMany({
    where: { shootingPlan: { projectId } },
    select: { captureStatus: true },
  });
  return { captureStatus: "SKIPPED" as const, progress: calculateCaptureProgress(statuses.map((item) => item.captureStatus)) };
}
