import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import { ffmpegBinary, hasAudioStream, probeVideo, runVideoDiagnostic } from "./video";
import type { TranscriptSegment } from "../packages/ai/speech-to-text-provider";

function splitCaption(text: string) {
  if (text.length <= 16) return [text];
  const pieces: string[] = [];
  let remaining = text;
  while (remaining.length > 16) {
    const chunk = remaining.slice(0, 16);
    const boundary = Math.max(chunk.lastIndexOf("，"), chunk.lastIndexOf("。"), chunk.lastIndexOf("！"), chunk.lastIndexOf("？"), chunk.lastIndexOf(" "));
    const end = boundary >= 6 ? boundary + 1 : 16;
    pieces.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

export function validateTranscript(segments: TranscriptSegment[], duration: number) {
  return segments.filter((item) => Number.isFinite(item.startTime) && Number.isFinite(item.endTime) && item.startTime >= 0 && item.endTime > item.startTime && item.endTime <= duration + 0.1 && item.text.trim()).flatMap((item) => {
    const text = item.text.trim().replace(/\s+/g, " ");
    const parts = splitCaption(text);
    const start = Math.max(0, item.startTime);
    const end = Math.min(duration, item.endTime);
    return parts.map((part, index) => ({ ...item, startTime: start + ((end - start) * index) / parts.length, endTime: start + ((end - start) * (index + 1)) / parts.length, text: part }));
  });
}
function assTime(value: number) { const cs = Math.round(value * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, "0")}:${String(Math.floor(cs / 100) % 60).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`; }
function assText(value: string) { return value.replace(/[\\{}]/g, "\\$&").replace(/\n/g, "\\N"); }
export async function writeAss(filePath: string, segments: TranscriptSegment[], width: number, height: number) {
  const marginV = height > width ? Math.round(height * 0.13) : Math.round(height * 0.1);
  const fontSize = height > width ? 42 : 34;
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,Arial,${fontSize},&H00FFFFFF,&H00101010,&H64000000,1,0,0,0,100,100,0,0,1,3,1,2,36,36,${marginV},1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`;
  await writeFile(filePath, header + segments.map((item) => `Dialogue: 0,${assTime(item.startTime)},${assTime(item.endTime)},Default,,0,0,0,,${assText(item.text)}`).join("\n"), "utf8");
}
export async function finalProgramChecks(filePath: string) {
  const metadata = await probeVideo(filePath, "mp4"); const audio = await hasAudioStream(filePath);
  const output = await runVideoDiagnostic(ffmpegBinary(), ["-hide_banner", "-loglevel", "info", "-i", filePath, "-vf", "blackdetect=d=1:pix_th=0.10", "-an", "-f", "null", "-"], 120_000);
  return { metadata, audio, blackScreen: /black_start:/.test(output) };
}
export async function loadSegments(filePath: string) { return JSON.parse(await readFile(filePath, "utf8")) as TranscriptSegment[]; }
