import "server-only";
import { execFile } from "node:child_process";
import path from "node:path";
import { WorkflowError } from "../../../lib/errors";
import type { SpeechToTextProvider, TranscriptResult } from "../speech-to-text-provider";

export class LocalWhisperProvider implements SpeechToTextProvider {
  constructor(private readonly config: { model: string; python?: string }) {}

  transcribe(input: { localFilePath: string; mimeType: "audio/mpeg"; duration: number }): Promise<TranscriptResult> {
    const script = path.resolve(process.cwd(), "scripts", "local-whisper.py");
    return new Promise((resolve, reject) => {
      execFile(/* turbopackIgnore: true */ this.config.python || process.env.LOCAL_WHISPER_PYTHON || "python", [script, input.localFilePath], {
        windowsHide: true,
        timeout: 10 * 60_000,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, LOCAL_WHISPER_MODEL: this.config.model, PYTHONIOENCODING: "utf-8" },
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new WorkflowError("LOCAL_STT_FAILED", "本地字幕转写失败，请确认 Whisper 模型已安装。", 503, { cause: new Error(`${error.message}\n${stderr}`) }));
          return;
        }
        try {
          const value = JSON.parse(stdout) as TranscriptResult;
          resolve({ language: typeof value.language === "string" ? value.language : null, segments: Array.isArray(value.segments) ? value.segments : [] });
        } catch (parseError) {
          reject(new WorkflowError("LOCAL_STT_FAILED", "本地字幕转写结果无效。", 503, { cause: parseError }));
        }
      });
    });
  }
}
