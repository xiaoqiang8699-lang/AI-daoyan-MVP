import "server-only";
import { execFile } from "node:child_process";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { WorkflowError } from "./errors";
import type { VideoExtension } from "./upload-rules";

export interface VideoMetadata { duration: number; width: number; height: number; fps: number; codec: string }

export function runVideoTool(binary: string, args: string[], timeout = 60_000, maxBuffer = 16 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { windowsHide: true, timeout, maxBuffer, encoding: "buffer" }, (error, stdout, stderr) => {
      if (error) reject(new WorkflowError("VIDEO_PROCESSING_FAILED", "视频处理失败，请检查视频文件后重试。", 422, { cause: new Error(`${error.message}\n${stderr.toString()}`) }));
      else resolve(stdout);
    });
  });
}

export function runVideoCommand(binary: string, args: string[], timeout = 300_000): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) reject(new WorkflowError("VIDEO_PROCESSING_FAILED", "视频处理失败，请稍后重新生成。", 422, { cause: new Error(`${error.message}\n${stderr}`) }));
      else resolve();
    });
  });
}

export function runVideoDiagnostic(binary: string, args: string[], timeout = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new WorkflowError("VIDEO_PROCESSING_FAILED", "视频检查失败，请稍后重试。", 422, { cause: new Error(`${error.message}\n${stderr}`) }));
      else resolve(`${stdout}\n${stderr}`);
    });
  });
}

export function ffmpegBinary() {
  const binary = process.env.FFMPEG_PATH || ffmpeg;
  if (!binary) throw new WorkflowError("VIDEO_TOOL_MISSING", "视频处理工具尚未就绪，请联系管理员。", 503);
  return binary;
}

export async function hasAudioStream(filePath: string) {
  const data = JSON.parse((await runVideoTool(process.env.FFPROBE_PATH || ffprobe.path, ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-of", "json", filePath])).toString());
  return data.streams?.some((item: { codec_type?: string }) => item.codec_type === "audio") === true;
}

export async function extractReferenceClip(filePath: string, startTime: number, endTime: number): Promise<Buffer> {
  const binary = ffmpegBinary();
  const duration = endTime - startTime;
  if (!Number.isFinite(startTime) || !Number.isFinite(duration) || startTime < 0 || duration <= 0) {
    throw new WorkflowError("INVALID_REFERENCE_RANGE", "参考镜头的时间范围无效。", 422);
  }
  const clip = await runVideoTool(binary, [
    "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe",
    "-ss", startTime.toFixed(3), "-i", filePath, "-t", duration.toFixed(3),
    "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-c:a", "aac", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1",
  ], 120_000, 64 * 1024 * 1024);
  if (!clip.length) throw new WorkflowError("REFERENCE_CLIP_FAILED", "无法生成参考片段，请稍后重试。", 422);
  return clip;
}

export async function probeVideo(filePath: string, extension: VideoExtension): Promise<VideoMetadata> {
  let data;
  try {
    data = JSON.parse((await runVideoTool(process.env.FFPROBE_PATH || ffprobe.path, ["-v", "error", "-protocol_whitelist", "file,pipe", "-show_format", "-show_streams", "-of", "json", filePath])).toString());
  } catch (error) {
    throw new WorkflowError("INVALID_VIDEO", "视频文件损坏或无法读取，请换一个视频。", 422, { cause: error });
  }
  const stream = data.streams?.find((item: { codec_type: string; disposition?: { attached_pic?: number } }) => item.codec_type === "video" && !item.disposition?.attached_pic);
  const duration = Number(data.format?.duration || stream?.duration);
  const [numerator, denominator] = String(stream?.avg_frame_rate || "0/1").split("/").map(Number);
  const fps = numerator / (denominator || 1);
  const format = String(data.format?.format_name || "");
  if (extension === "webm" ? !format.includes("webm") : !format.includes("mov") && !format.includes("mp4")) {
    throw new WorkflowError("UNSUPPORTED_FORMAT", "视频内容与文件格式不一致，请选择 MP4、MOV 或 WebM 视频。", 422);
  }
  if (!stream || !Number.isFinite(duration) || duration <= 0 || !stream.width || !stream.height || !Number.isFinite(fps) || fps <= 0) {
    throw new WorkflowError("INVALID_VIDEO", "没有读取到有效的视频画面或时长。", 422);
  }
  return { duration, width: stream.width, height: stream.height, fps, codec: stream.codec_name || "unknown" };
}

export async function extractReferenceFrame(filePath: string, time: number): Promise<Buffer> {
  const binary = ffmpegBinary();
  const jpeg = await runVideoTool(binary, ["-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe", "-ss", time.toFixed(3), "-i", filePath, "-map", "0:v:0", "-frames:v", "1", "-vf", "scale=640:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"], 30_000);
  if (jpeg.length < 3 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new WorkflowError("FRAME_FAILED", "无法提取参考画面，请重新分析。", 422);
  return jpeg;
}

export async function extractMaterialThumbnail(filePath: string, type: "VIDEO" | "IMAGE"): Promise<Buffer> {
  const args = type === "VIDEO" ? ["-ss", "0.2", "-i", filePath] : ["-i", filePath];
  const jpeg = await runVideoTool(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe", ...args, "-frames:v", "1", "-vf", "scale=640:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"], 30_000);
  if (jpeg.length < 3 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new WorkflowError("FRAME_FAILED", "无法生成素材缩略图。", 422);
  return jpeg;
}
