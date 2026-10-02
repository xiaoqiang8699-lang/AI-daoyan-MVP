import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { publicError, WorkflowError } from "@/lib/errors";
import { logEvent } from "@/lib/logger";
import { requireSameOrigin } from "@/lib/request-security";
import { saveTakeUpload, skipPlannedShot } from "@/lib/takes";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; plannedShotId: string }> }) {
  const { id, plannedShotId } = await params;
  const started = Date.now();
  try {
    requireSameOrigin(request);
    if (!request.body) throw new WorkflowError("EMPTY_FILE", "请先选择要使用的视频。", 400);
    let fileName: string;
    try { fileName = decodeURIComponent(request.headers.get("x-file-name") || ""); }
    catch { throw new WorkflowError("INVALID_FILE_NAME", "视频文件名无效。", 400); }
    const size = Number(request.headers.get("content-length") || request.headers.get("x-file-size"));
    const mimeType = request.headers.get("content-type")?.split(";")[0] || "";
    const result = await saveTakeUpload({
      projectId: id,
      plannedShotId,
      fileName,
      size,
      mimeType,
      source: Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>),
    });
    await recordProductEvent({ eventName: AnalyticsEvent.TAKE_UPLOADED, projectId: id, eventData: { duration: result.take.duration } });
    await recordProductEvent({ eventName: AnalyticsEvent.SHOT_COMPLETED, projectId: id });
    logEvent("take.upload_success", { projectId: id, plannedShotId, takeId: result.take.id, size: result.take.fileSize, duration: result.take.duration, durationMs: Date.now() - started });
    return Response.json(result, { status: 201 });
  } catch (error) {
    logEvent("take.upload_fail", { projectId: id, plannedShotId, durationMs: Date.now() - started, error });
    const failure = publicError(error);
    return Response.json({ error: failure.error, code: failure.code }, { status: failure.status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; plannedShotId: string }> }) {
  const { id, plannedShotId } = await params;
  try {
    requireSameOrigin(request);
    const body = await request.json().catch(() => null) as { action?: unknown } | null;
    if (body?.action !== "skip") throw new WorkflowError("INVALID_ACTION", "无法识别这个操作。", 400);
    return Response.json(await skipPlannedShot(id, plannedShotId));
  } catch (error) {
    const failure = publicError(error);
    return Response.json({ error: failure.error, code: failure.code }, { status: failure.status });
  }
}
