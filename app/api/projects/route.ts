import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { db } from "@/lib/db";
import { ensureDemoUser, DEMO_USER_ID } from "@/lib/demo-user";
import { WorkflowError, publicError } from "@/lib/errors";
import { logEvent } from "@/lib/logger";
import { requireSameOrigin } from "@/lib/request-security";
import { getStorageProvider } from "@/lib/storage";
import { VIDEO_TYPES, validateVideoFile } from "@/lib/upload-rules";
import { probeVideo } from "@/lib/video";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";
import { attachTestSession, TEST_SESSION_COOKIE } from "@/lib/test-sessions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const storage = getStorageProvider();
  let projectId: string | undefined;
  let storageKey: string | undefined;
  try {
    requireSameOrigin(request);
    let name: string;
    let fileName: string;
    try {
      name = decodeURIComponent(request.headers.get("x-project-name") || "").trim();
      fileName = decodeURIComponent(request.headers.get("x-file-name") || "");
    } catch { throw new WorkflowError("INVALID_NAME", "项目名称或文件名称无效。"); }
    if (!name || name.length > 80) throw new WorkflowError("INVALID_NAME", "请输入 1 至 80 个字的项目名称。");
    if (fileName.length > 255) throw new WorkflowError("INVALID_FILE_NAME", "视频文件名过长，请缩短文件名。");
    const size = Number(request.headers.get("content-length") || request.headers.get("x-file-size"));
    const extension = validateVideoFile(fileName, size, request.headers.get("content-type")?.split(";")[0] || "");
    if (!request.body) throw new WorkflowError("EMPTY_FILE", "请先选择参考视频。");
    await ensureDemoUser();
    await recordProductEvent({ eventName: AnalyticsEvent.REFERENCE_VIDEO_UPLOAD_STARTED });
    const project = await db.project.create({ data: { userId: DEMO_USER_ID, name } });
    projectId = project.id;
    await attachTestSession(request.headers.get("cookie")?.match(new RegExp(`${TEST_SESSION_COOKIE}=([^;]+)`))?.[1], projectId);
    await recordProductEvent({ eventName: AnalyticsEvent.PROJECT_CREATED, projectId });
    const stored = await storage.saveReferenceVideo(projectId, extension, Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>));
    storageKey = stored.key;
    if (stored.size !== size) throw new WorkflowError("INCOMPLETE_UPLOAD", "视频上传不完整，请重新上传。");
    const metadata = await probeVideo((await storage.getLocalFile(stored.key)).path, extension);
    const reference = await db.referenceVideo.create({ data: {
      projectId, fileUrl: stored.url, storageKey: stored.key, originalName: fileName, size: stored.size, mimeType: VIDEO_TYPES[extension], ...metadata,
    } });
    await db.project.update({ where: { id: projectId }, data: { status: "ANALYZING" } });
    await recordProductEvent({ eventName: AnalyticsEvent.REFERENCE_VIDEO_UPLOAD_COMPLETED, projectId, eventData: { duration: metadata.duration } });
    logEvent("upload.success", { projectId, referenceVideoId: reference.id, size: stored.size, duration: metadata.duration });
    return Response.json({ projectId }, { status: 201 });
  } catch (error) {
    logEvent("upload.fail", { projectId, error });
    if (storageKey) {
      try { await storage.deleteFile(storageKey); } catch (cleanupError) { logEvent("upload.cleanup_failed", { projectId, error: cleanupError }); }
    }
    if (projectId) {
      try { await db.project.delete({ where: { id: projectId } }); } catch (cleanupError) { logEvent("upload.project_cleanup_failed", { projectId, error: cleanupError }); }
    }
    const failure = publicError(error);
    return Response.json({ error: failure.error, code: failure.code }, { status: failure.status });
  }
}
