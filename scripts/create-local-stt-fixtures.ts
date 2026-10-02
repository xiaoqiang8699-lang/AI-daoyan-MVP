import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { ffmpegBinary, runVideoCommand } from "../lib/video";

const root = path.resolve("test-results/local-stt-benchmark");
function run(command: string, args: string[]) { return new Promise<void>((resolve, reject) => execFile(command, args, { windowsHide: true }, (error) => error ? reject(error) : resolve())); }
function encodedPowerShell(value: string) { return Buffer.from(value, "utf16le").toString("base64"); }
async function speak(text: string, name: string) {
  const wav = path.join(root, `${name}.wav`);
  const script = `Add-Type -AssemblyName System.Speech;$voice=New-Object System.Speech.Synthesis.SpeechSynthesizer;$voice.SelectVoice('Microsoft Huihui Desktop');$voice.Rate=-1;$voice.SetOutputToWaveFile('${wav.replace(/'/g, "''")}');$voice.Speak('${text.replace(/'/g, "''")}');$voice.Dispose()`;
  await run("powershell", ["-NoProfile", "-EncodedCommand", encodedPowerShell(script)]);
  await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "96k", path.join(root, `${name}.mp3`)]);
  await rm(wav, { force: true });
}
async function main() {
  await mkdir(root, { recursive: true });
  await speak("今天阳光很好。", "a-clear");
  await speak("镜头已经准备好了。", "b-noise-source");
  await speak("开始吧。", "c-short");
  await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", "-i", path.join(root, "b-noise-source.mp3"), "-f", "lavfi", "-i", "anoisesrc=color=pink:sample_rate=44100:amplitude=0.035", "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first", "-c:a", "libmp3lame", "-b:a", "96k", path.join(root, "b-noise.mp3")]);
  await rm(path.join(root, "b-noise-source.mp3"), { force: true });
  await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "2", "-c:a", "libmp3lame", "-b:a", "96k", path.join(root, "d-silence.mp3")]);
  await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", "-i", path.resolve("test-results/trim-benchmark/smart-trim-ab.mp4"), "-vn", "-c:a", "libmp3lame", "-b:a", "96k", path.join(root, "smart-trim-local.mp3")]);
}
void main();
