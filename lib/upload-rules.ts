import { WorkflowError } from "./errors";

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_TAKE_BYTES = 100 * 1024 * 1024;
export const VIDEO_TYPES = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" } as const;
export type VideoExtension = keyof typeof VIDEO_TYPES;

export function validateVideoFile(name: string, size: number, mimeType: string): VideoExtension {
  return validateVideo(name, size, mimeType, MAX_VIDEO_BYTES, "200MB");
}

export function validateTakeVideoFile(name: string, size: number, mimeType: string): VideoExtension {
  return validateVideo(name, size, mimeType, MAX_TAKE_BYTES, "100MB");
}

function validateVideo(name: string, size: number, mimeType: string, maxBytes: number, limitLabel: string): VideoExtension {
  const extension = name.split(".").pop()?.toLowerCase();
  if (!extension || !(extension in VIDEO_TYPES)) throw new WorkflowError("UNSUPPORTED_FORMAT", "视频格式不支持，请选择 MP4、MOV 或 WebM 视频。");
  if (!Number.isFinite(size) || size <= 0) throw new WorkflowError("EMPTY_FILE", "视频文件为空，请重新选择。");
  if (size > maxBytes) throw new WorkflowError("FILE_TOO_LARGE", `视频过大，最大支持 ${limitLabel}。`, 413);
  const ext = extension as VideoExtension;
  if (mimeType && mimeType !== "application/octet-stream" && mimeType !== VIDEO_TYPES[ext]) {
    throw new WorkflowError("UNSUPPORTED_FORMAT", "视频格式与文件名称不一致，请重新选择视频。");
  }
  return ext;
}
