import { mkdir } from "node:fs/promises";
import path from "node:path";
import { ffmpegBinary, runVideoCommand } from "../lib/video";

async function makeVideo(name: string, color: string) {
  await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=${color}:s=720x1280:d=2`, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", path.join("test-fixtures", "step10b-e2e", name)]);
}
async function main() {
  await mkdir(path.join("test-fixtures", "step10b-e2e"), { recursive: true });
  await Promise.all([makeVideo("blue-action.mp4", "#3b82f6"), makeVideo("green-detail.mp4", "#22c55e")]);
  await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=#f59e0b:s=720x1280", "-frames:v", "1", "-y", path.join("test-fixtures", "step10b-e2e", "orange-scene.jpg")]);
}
void main();
