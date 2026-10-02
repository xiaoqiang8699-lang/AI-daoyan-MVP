import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { ffmpegBinary, runVideoCommand } from "../lib/video";

const root = path.resolve("test-fixtures/final-qa");
async function command(args: string[]) { await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", ...args], 120_000); }
async function main() {
  await mkdir(root, { recursive: true });
  const normal = path.join(root, "normal.mp4");
  await command(["-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=6", "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", normal]);
  await command(["-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=2", "-f", "lavfi", "-i", "color=c=black:size=720x1280:rate=30:duration=2", "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=6", "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]", "-map", "[v]", "-map", "3:a:0", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", path.join(root, "black-screen.mp4")]);
  const ass = path.join(root, "blocking.ass");
  await writeFile(ass, "[Script Info]\nScriptType: v4.00+\nPlayResX: 720\nPlayResY: 1280\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,Arial,60,&H00FFFFFF,&H00101010,&H64000000,1,0,0,0,100,100,0,0,1,3,1,5,36,36,0,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\nDialogue: 0,0:00:00.00,0:00:06.00,Default,,0,0,0,,测试字幕位于主体核心区域", "utf8");
  const filter = `subtitles=filename='${ass.replace(/\\/g, "/").replace(/:/g, "\\:")}'`;
  await command(["-i", normal, "-vf", filter, "-c:v", "libx264", "-c:a", "copy", "-movflags", "+faststart", path.join(root, "subtitle-blocking.mp4")]);
  await command(["-i", normal, "-c:v", "copy", "-an", "-movflags", "+faststart", path.join(root, "audio-missing.mp4")]);
  await copyFile(normal, path.join(root, "README-normal-source.mp4"));
  await writeFile(path.join(root, "manifest.json"), JSON.stringify({ publicTestAssets: true, containsIdentifiablePeople: false, containsPersonalData: false, cases: [{ id: "A", file: "normal.mp4", expected: "PASSED" }, { id: "B", file: "black-screen.mp4", expected: "BLACK_SCREEN" }, { id: "C", file: "subtitle-blocking.mp4", expected: "SUBTITLE_BLOCKING_SUBJECT" }, { id: "D", file: "audio-missing.mp4", expected: "AUDIO_MISSING" }] }, null, 2));
}
void main();
