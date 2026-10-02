import { WorkflowError } from "./errors";
import { MAX_VIDEO_BYTES, VIDEO_TYPES, type VideoExtension } from "./upload-rules";

export const IMAGE_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
export type MaterialExtension = VideoExtension | keyof typeof IMAGE_TYPES;

export function validateMaterialFile(name: string, size: number, mimeType: string) {
  const extension = name.split(".").pop()?.toLowerCase() as MaterialExtension | undefined;
  if (!extension || (!(extension in VIDEO_TYPES) && !(extension in IMAGE_TYPES))) throw new WorkflowError("UNSUPPORTED_FORMAT", "请上传 MP4、MOV、WebM、JPG、PNG 或 WebP 素材。");
  if (!Number.isFinite(size) || size <= 0) throw new WorkflowError("EMPTY_FILE", "素材文件为空，请重新选择。");
  if (size > MAX_VIDEO_BYTES) throw new WorkflowError("FILE_TOO_LARGE", "素材过大，最大支持 200MB。", 413);
  const expected = extension in VIDEO_TYPES ? VIDEO_TYPES[extension as VideoExtension] : IMAGE_TYPES[extension as keyof typeof IMAGE_TYPES];
  if (mimeType && mimeType !== "application/octet-stream" && mimeType !== expected) throw new WorkflowError("UNSUPPORTED_FORMAT", "素材格式与文件名称不一致，请重新选择。");
  return { extension, type: extension in VIDEO_TYPES ? "VIDEO" as const : "IMAGE" as const, mimeType: expected };
}
