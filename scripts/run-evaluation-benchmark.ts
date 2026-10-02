import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { applyEvaluationPolicy, deterministicTakeChecks } from "../packages/ai/evaluation-policy";
import { getTakeEvaluationConfig } from "../packages/ai/config";
import { getTakeEvaluationProvider } from "../packages/ai/get-video-ai-provider";
import { probeVideo } from "../lib/video";

const contextSchema = z.object({
  purpose: z.string(),
  actionInstruction: z.string(),
  cameraInstruction: z.string(),
  dialogue: z.string().nullable(),
  targetDuration: z.number().positive(),
}).strict();

const manifestSchema = z.object({
  device: z.string(),
  browser: z.string(),
  referenceVideo: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict(),
  cases: z.array(z.object({
    id: z.string(),
    label: z.string(),
    expected: z.enum(["PASSED", "NEEDS_RETAKE"]),
    takePath: z.string(),
    referenceClipPath: z.string(),
    takePrivacy: z.object({
      sourceContainsIdentifiablePerson: z.boolean(),
      copyContainsIdentifiablePerson: z.boolean(),
      processing: z.string(),
    }).strict(),
    referencePrivacy: z.object({
      copyContainsIdentifiablePerson: z.boolean(),
      durationSeconds: z.number().positive(),
      processing: z.string(),
    }).strict(),
    referenceShot: z.object({
      visualDescription: z.string(),
      shotSize: z.string(),
      cameraMovement: z.string(),
      targetDuration: z.number().positive(),
    }).strict(),
    plannedShot: contextSchema,
  }).strict()).min(1).max(6),
}).strict();

async function main() {
  if (process.env.ALLOW_BENCHMARK_MEDIA_UPLOAD !== "1") {
    throw new Error("Benchmark 会把 manifest 中的真实视频上传给已配置的 AI Provider。确认授权后设置 ALLOW_BENCHMARK_MEDIA_UPLOAD=1。 ");
  }
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error("用法：pnpm benchmark:evaluation -- <manifest.json> [output.json]");
  const outputPath = process.argv[3] || "test-results/evaluation-benchmark-results.json";
  const manifest = manifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));
  const provider = getTakeEvaluationProvider();
  const providerConfig = getTakeEvaluationConfig();
  const results: Array<{ correct: boolean; error?: string; [key: string]: unknown }> = [];

  async function saveReport() {
    const failed = results.filter((result) => result.error).length;
    const report = {
      generatedAt: new Date().toISOString(),
      device: manifest.device,
      browser: manifest.browser,
      provider: providerConfig,
      total: manifest.cases.length,
      completed: results.length - failed,
      failed,
      correct: results.filter((result) => result.correct).length,
      passed: results.length === manifest.cases.length && failed === 0 && results.filter((result) => result.correct).length >= 5,
      results,
    };
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return report;
  }

  for (const benchmarkCase of manifest.cases) {
    const takePath = path.resolve(benchmarkCase.takePath);
    const referenceClipPath = path.resolve(benchmarkCase.referenceClipPath);
    const metadata = await probeVideo(takePath, path.extname(takePath).toLowerCase() === ".mov" ? "mov" : "mp4");
    const checks = deterministicTakeChecks({
      take: metadata,
      targetDuration: benchmarkCase.plannedShot.targetDuration,
      referenceVideo: manifest.referenceVideo,
    });
    const started = Date.now();
    try {
      const modelResult = await provider.evaluateTake({
      referenceShot: benchmarkCase.referenceShot,
      plannedShot: benchmarkCase.plannedShot,
      take: {
        videoUrl: `benchmark://${benchmarkCase.id}`,
        localFilePath: takePath,
        mimeType: "video/mp4",
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
      },
      referenceClip: { localFilePath: referenceClipPath, mimeType: "video/mp4" },
      deterministicChecks: checks,
      });
      const result = applyEvaluationPolicy(modelResult);
      const actual = result.passed ? "PASSED" : "NEEDS_RETAKE";
      results.push({
        id: benchmarkCase.id,
        label: benchmarkCase.label,
        takeFile: path.basename(takePath),
        referenceClipFile: path.basename(referenceClipPath),
        takePrivacy: benchmarkCase.takePrivacy,
        referencePrivacy: benchmarkCase.referencePrivacy,
        expected: benchmarkCase.expected,
        actual,
        correct: actual === benchmarkCase.expected,
        deterministicChecks: checks,
        evaluation: result,
        elapsedMs: Date.now() - started,
      });
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      results.push({
        id: benchmarkCase.id,
        label: benchmarkCase.label,
        takeFile: path.basename(takePath),
        referenceClipFile: path.basename(referenceClipPath),
        takePrivacy: benchmarkCase.takePrivacy,
        referencePrivacy: benchmarkCase.referencePrivacy,
        expected: benchmarkCase.expected,
        actual: "EVALUATION_FAILED",
        correct: false,
        deterministicChecks: checks,
        elapsedMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
        errorDetail: cause instanceof Error ? cause.message : cause ? String(cause) : null,
      });
    }
    await saveReport();
  }

  const report = await saveReport();
  console.log(JSON.stringify({ outputPath, total: report.total, completed: report.completed, failed: report.failed, correct: report.correct, passed: report.passed }, null, 2));
  if (!report.passed) process.exitCode = 1;
}

void main();
