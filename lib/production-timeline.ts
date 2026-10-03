import "server-only";
import { db } from "@/lib/db";
import { WorkflowError } from "@/lib/errors";

export type ProductionTimelineItem = {
  order: number;
  sourceType: "MATERIAL_ASSET" | "CAPTURE_TAKE";
  sourceId: string;
  mediaStorageKey: string;
  sourceDuration: number;
  plannedDuration: number;
  role: string;
  trimStart: number | null;
  trimEnd: number | null;
  mediaType: "IMAGE" | "VIDEO";
};

const productionInclude = {
  opportunity: { include: { segments: { orderBy: { order: "asc" }, include: { materialAsset: true } } } },
  captureTasks: { orderBy: { order: "asc" }, include: { selectedTake: { include: { trimDecision: true } } } },
} as const;

export async function buildProductionTimeline(productionPlanId: string, options?: { allowOutdated?: boolean }) {
  const plan = await db.productionPlan.findUnique({ where: { id: productionPlanId }, include: productionInclude });
  if (!plan) throw new WorkflowError("PRODUCTION_NOT_FOUND", "找不到这份制作方案。", 404);
  if (plan.status !== "MATERIALS_READY" && !(options?.allowOutdated && plan.status === "OUTDATED")) throw new WorkflowError("PRODUCTION_NOT_READY", "补拍素材尚未齐全，暂时不能生成视频。", 409);

  const captureDuration = plan.captureTasks.reduce((sum, task) => {
    const take = task.selectedTake;
    if (!take) return sum;
    const trim = take.trimDecision;
    return sum + (trim && trim.startTime >= 0 && trim.endTime > trim.startTime && trim.endTime <= take.duration ? trim.endTime - trim.startTime : Math.min(take.duration, Math.max(task.targetDuration, 1)));
  }, 0);
  const imageCount = plan.opportunity.segments.filter((segment) => segment.materialAsset?.type === "IMAGE").length;
  const imageDuration = imageCount ? Math.max(2, Math.min(4, (plan.targetDuration - captureDuration) / imageCount)) : 3;
  const items: ProductionTimelineItem[] = [];
  for (const segment of plan.opportunity.segments) {
    const asset = segment.materialAsset;
    if (!asset || asset.analysisStatus !== "ANALYZED" || !asset.storageKey) throw new WorkflowError("TIMELINE_SOURCE_MISSING", "已有素材已变化，请重新整理后再生成。", 409);
    const isImage = asset.type === "IMAGE";
    const sourceDuration = isImage ? 0 : asset.duration || 0;
    const suggested = !isImage && segment.suggestedEnd !== null && segment.suggestedStart !== null ? segment.suggestedEnd - segment.suggestedStart : null;
    const plannedDuration = isImage ? imageDuration : suggested && suggested > 0 ? suggested : Math.min(Math.max(sourceDuration, 1), 5);
    if (!Number.isFinite(plannedDuration) || plannedDuration <= 0 || (!isImage && sourceDuration <= 0)) throw new WorkflowError("TIMELINE_DURATION_INVALID", "素材时长无效，无法生成视频。", 422);
    items.push({ order: segment.order, sourceType: "MATERIAL_ASSET", sourceId: asset.id, mediaStorageKey: asset.storageKey, sourceDuration, plannedDuration, role: segment.role, trimStart: isImage ? null : segment.suggestedStart, trimEnd: isImage ? null : segment.suggestedEnd, mediaType: isImage ? "IMAGE" : "VIDEO" });
  }
  const captureOffset = items.length ? Math.max(...items.map((item) => item.order)) + 1 : 1;
  for (const task of plan.captureTasks) {
    const take = task.selectedTake;
    if (!take) throw new WorkflowError("TIMELINE_CAPTURE_MISSING", "仍有补拍任务没有采用的视频。", 409);
    const trim = take.trimDecision;
    const validTrim = trim && trim.startTime >= 0 && trim.endTime > trim.startTime && trim.endTime <= take.duration ? trim : null;
    items.push({ order: captureOffset + task.order, sourceType: "CAPTURE_TAKE", sourceId: take.id, mediaStorageKey: storageKeyFromUrl(take.videoUrl), sourceDuration: take.duration, plannedDuration: validTrim ? validTrim.endTime - validTrim.startTime : Math.min(take.duration, Math.max(task.targetDuration, 1)), role: "ACTION", trimStart: validTrim?.startTime ?? 0, trimEnd: validTrim?.endTime ?? take.duration, mediaType: "VIDEO" });
  }
  const orders = new Set(items.map((item) => item.order));
  if (orders.size !== items.length || !items.length) throw new WorkflowError("TIMELINE_ORDER_INVALID", "时间线顺序无效，无法生成视频。", 422);
  return { plan, items: items.sort((a, b) => a.order - b.order) };
}

export function productionTimelineOutdated(snapshot: unknown, current: ProductionTimelineItem[]) {
  if (!snapshot || typeof snapshot !== "object") return true;
  const value = snapshot as { timeline?: ProductionTimelineItem[]; productionPlanId?: string };
  if (!Array.isArray(value.timeline) || value.timeline.length !== current.length) return true;
  return value.timeline.some((item, index) => {
    const now = current[index];
    return item.order !== now.order || item.sourceType !== now.sourceType || item.sourceId !== now.sourceId || item.mediaStorageKey !== now.mediaStorageKey || item.sourceDuration !== now.sourceDuration || item.plannedDuration !== now.plannedDuration || item.role !== now.role || item.trimStart !== now.trimStart || item.trimEnd !== now.trimEnd || item.mediaType !== now.mediaType;
  });
}

function storageKeyFromUrl(url: string) {
  const prefix = "/api/files/";
  if (!url.startsWith(prefix)) throw new WorkflowError("FILE_MISSING", "补拍素材地址无效。", 422);
  return url.slice(prefix.length);
}
