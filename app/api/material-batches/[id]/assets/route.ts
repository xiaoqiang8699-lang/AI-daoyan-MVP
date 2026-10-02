import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { WorkflowError, publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { getStorageProvider } from "@/lib/storage";
import { validateMaterialFile } from "@/lib/material-rules";
import { probeVideo, extractMaterialThumbnail } from "@/lib/video";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let storageKey: string | undefined;
  try {
    requireSameOrigin(request); const batchId = (await params).id;
    const batch = await db.materialBatch.findFirst({ where: { id: batchId, userId: DEMO_USER_ID }, select: { id: true } });
    if (!batch) throw new WorkflowError("MATERIAL_BATCH_NOT_FOUND", "找不到这组素材。", 404);
    const fileName = decodeURIComponent(request.headers.get("x-file-name") || "");
    const size = Number(request.headers.get("content-length") || request.headers.get("x-file-size"));
    const file = validateMaterialFile(fileName, size, request.headers.get("content-type")?.split(";")[0] || "");
    if (!request.body) throw new WorkflowError("EMPTY_FILE", "请先选择素材。");
    const assetId = randomUUID(); const storage = getStorageProvider();
    if (!storage.saveMaterial || !storage.saveMaterialThumbnail) throw new WorkflowError("STORAGE_UNAVAILABLE", "素材存储服务尚未就绪。", 503);
    const stored = await storage.saveMaterial(batchId, assetId, file.extension, Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>)); storageKey = stored.key;
    if (stored.size !== size) throw new WorkflowError("INCOMPLETE_UPLOAD", "素材上传不完整，请重新上传。");
    const metadata = file.type === "VIDEO" ? await probeVideo((await storage.getLocalFile(stored.key)).path, file.extension as "mp4" | "mov" | "webm") : null;
    const thumbnail = await storage.saveMaterialThumbnail(batchId, assetId, await extractMaterialThumbnail((await storage.getLocalFile(stored.key)).path, file.type));
    const asset = await db.materialAsset.create({ data: { id: assetId, batchId, type: file.type, storageKey: stored.key, fileUrl: stored.url, mimeType: file.mimeType, fileSize: stored.size, duration: metadata?.duration, width: metadata?.width || null, height: metadata?.height || null, thumbnailStorageKey: thumbnail.key, thumbnailUrl: thumbnail.url, analysisStatus: "READY" } });
    await db.materialBatch.update({ where: { id: batchId }, data: { status: "READY" } });
    await recordProductEvent({ eventName: AnalyticsEvent.MATERIAL_UPLOADED, eventData: { type: file.type, size: stored.size } });
    return Response.json(asset, { status: 201 });
  } catch (error) { if (storageKey) await getStorageProvider().deleteFile(storageKey).catch(() => undefined); const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); }
}
