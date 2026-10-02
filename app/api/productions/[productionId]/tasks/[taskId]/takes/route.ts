import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { publicError, WorkflowError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { saveCaptureTaskTake, skipCaptureTask } from "@/lib/capture-tasks";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ productionId: string; taskId: string }> }) { try { requireSameOrigin(request); if (!request.body) throw new WorkflowError("EMPTY_FILE", "请先选择视频。", 400); const { productionId, taskId } = await params; const result = await saveCaptureTaskTake({ productionId, captureTaskId: taskId, fileName: decodeURIComponent(request.headers.get("x-file-name") || ""), size: Number(request.headers.get("content-length") || request.headers.get("x-file-size")), mimeType: request.headers.get("content-type")?.split(";")[0] || "", source: Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>) }); return Response.json(result, { status: 201 }); } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ productionId: string; taskId: string }> }) { try { requireSameOrigin(request); if ((await request.json()).action !== "skip") throw new WorkflowError("INVALID_ACTION", "无法识别操作。", 400); const { productionId, taskId } = await params; return Response.json(await skipCaptureTask(productionId, taskId)); } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); } }
