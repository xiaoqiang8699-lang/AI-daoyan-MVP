import "server-only";
import { GoogleGenAI, type File as GeminiFile, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { setTimeout as delay } from "node:timers/promises";
import { WorkflowError } from "../../../lib/errors";
import { logEvent } from "../../../lib/logger";
import { ANALYZE_REFERENCE_INSTRUCTION, analysisPrompt } from "../prompts/analyze-reference";
import { GENERATE_PLAN_INSTRUCTION, regenerateShotPrompt, shootingPlanPrompt } from "../prompts/generate-shooting-plan";
import { EVALUATE_TAKE_INSTRUCTION, evaluateTakePrompt } from "../prompts/evaluate-take";
import { parsePlannedShots, plannedShotsJsonSchema } from "../planned-shot-schema";
import { parseShotPlans, shotPlansJsonSchema } from "../shot-schema";
import { parseTakeEvaluation, takeEvaluationJsonSchema } from "../take-evaluation-schema";
import type { AnalyzeReferenceInput, EvaluateTakeInput, GenerateShootingPlanInput, PlannedShotPlan, RegeneratePlannedShotInput, ShotPlan, TakeEvaluation } from "../types";
import type { VideoAIProvider } from "../video-ai-provider";

// Narrow transport surface keeps external calls replaceable in unit tests.
export interface GeminiTransport {
  files: {
    upload(input: { file: string; config: { mimeType: string } }): Promise<GeminiFile>;
    get(input: { name: string }): Promise<GeminiFile>;
    delete(input: { name: string }): Promise<unknown>;
  };
  models: { generateContent(input: GenerateContentParameters): Promise<GenerateContentResponse> };
}

export class GeminiVideoAIProvider implements VideoAIProvider {
  private readonly client: GeminiTransport;
  constructor(private readonly config: { apiKey: string; model: string }, client?: GeminiTransport) {
    this.client = client ?? new GoogleGenAI({ apiKey: config.apiKey, httpOptions: { timeout: 300_000 } });
  }

  async analyzeReferenceVideo(input: AnalyzeReferenceInput): Promise<ShotPlan[]> {
    if (!input.localFilePath || !input.mimeType) throw new WorkflowError("REFERENCE_MISSING", "没有找到已上传的视频，请重新创建项目。", 422);
    let uploaded: GeminiFile | undefined;
    try {
      uploaded = await this.client.files.upload({ file: input.localFilePath, config: { mimeType: input.mimeType } });
      if (!uploaded.name) throw new WorkflowError("AI_UPLOAD_FAILED", "AI 服务未能读取视频，请稍后重试。", 502);
      let file = uploaded;
      const deadline = Date.now() + 300_000;
      while (file.state !== "ACTIVE") {
        if (file.state === "FAILED") throw new WorkflowError("AI_VIDEO_FAILED", "AI 服务无法读取这个视频，请换一个视频。", 422);
        if (Date.now() > deadline) throw new WorkflowError("AI_TIMEOUT", "视频读取超时，请稍后重新分析。", 504);
        await delay(2000);
        file = await this.client.files.get({ name: uploaded.name });
      }
      if (!file.uri) throw new WorkflowError("AI_UPLOAD_FAILED", "AI 服务未能读取视频，请稍后重试。", 502);
      const response = await this.client.models.generateContent({
        model: this.config.model,
        contents: [{ role: "user", parts: [
          { fileData: { fileUri: file.uri, mimeType: input.mimeType }, videoMetadata: { fps: 2 } },
          { text: analysisPrompt(input.duration) },
        ] }],
        config: {
          systemInstruction: ANALYZE_REFERENCE_INSTRUCTION,
          responseMimeType: "application/json",
          responseJsonSchema: shotPlansJsonSchema,
          maxOutputTokens: 32768,
          abortSignal: AbortSignal.timeout(300_000),
        },
      });
      return parseShotPlans(response.text || "", input.duration);
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) throw new WorkflowError("AI_ACCESS_DENIED", "分析服务授权失败，请联系管理员。", 503, { cause: error });
      if (status === 429) throw new WorkflowError("AI_RATE_LIMIT", "分析服务繁忙或额度暂时不足，请稍后重试。", 503, { cause: error });
      throw new WorkflowError("AI_UNAVAILABLE", "AI 服务暂时不可用，请稍后重新分析。", 502, { cause: error });
    } finally {
      if (uploaded?.name) {
        try { await this.client.files.delete({ name: uploaded.name }); }
        catch (error) { logEvent("ai.remote_file_cleanup_failed", { provider: "gemini", model: this.config.model, fileName: uploaded.name, error }); }
      }
    }
  }

  private async requestShootingPlan(input: GenerateShootingPlanInput, prompt: string) {
    try {
      const response = await this.client.models.generateContent({
        model: this.config.model,
        contents: prompt,
        config: {
          systemInstruction: GENERATE_PLAN_INSTRUCTION,
          responseMimeType: "application/json",
          responseJsonSchema: plannedShotsJsonSchema,
          maxOutputTokens: 32768,
          abortSignal: AbortSignal.timeout(300_000),
        },
      });
      return parsePlannedShots(response.text || "", input.referenceShots);
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) throw new WorkflowError("AI_ACCESS_DENIED", "生成服务授权失败，请联系管理员。", 503, { cause: error });
      if (status === 429) throw new WorkflowError("AI_RATE_LIMIT", "生成服务繁忙或额度暂时不足，请稍后重试。", 503, { cause: error });
      throw new WorkflowError("AI_UNAVAILABLE", "AI 服务暂时无法生成拍摄方案，请稍后重试。", 502, { cause: error });
    }
  }

  generateShootingPlan(input: GenerateShootingPlanInput): Promise<PlannedShotPlan[]> {
    return this.requestShootingPlan(input, shootingPlanPrompt(input));
  }

  async regeneratePlannedShot(input: RegeneratePlannedShotInput): Promise<PlannedShotPlan> {
    const shots = await this.requestShootingPlan(input, regenerateShotPrompt(input));
    return shots[0];
  }

  async evaluateTake(input: EvaluateTakeInput): Promise<TakeEvaluation> {
    const uploaded: GeminiFile[] = [];
    try {
      const activeFiles = [];
      for (const media of [input.referenceClip, input.take]) {
        let file = await this.client.files.upload({ file: media.localFilePath, config: { mimeType: media.mimeType } });
        uploaded.push(file);
        if (!file.name) throw new WorkflowError("AI_UPLOAD_FAILED", "AI 服务未能读取视频，请稍后重新检查。", 502);
        const fileName = file.name;
        const deadline = Date.now() + 300_000;
        while (file.state !== "ACTIVE") {
          if (file.state === "FAILED") throw new WorkflowError("AI_VIDEO_FAILED", "AI 服务无法读取这条视频，请重新拍摄或稍后重试。", 422);
          if (Date.now() > deadline) throw new WorkflowError("AI_TIMEOUT", "视频读取超时，请稍后重新检查。", 504);
          await delay(2000);
          file = await this.client.files.get({ name: fileName });
        }
        if (!file.uri) throw new WorkflowError("AI_UPLOAD_FAILED", "AI 服务未能读取视频，请稍后重新检查。", 502);
        activeFiles.push({ uri: file.uri, mimeType: media.mimeType });
      }
      const response = await this.client.models.generateContent({
        model: this.config.model,
        contents: [{ role: "user", parts: [
          { text: `${evaluateTakePrompt(input)}\n第一个视频是 Reference Shot 参考片段，第二个视频是需要评价的真实 User Take。` },
          { fileData: { fileUri: activeFiles[0].uri, mimeType: activeFiles[0].mimeType }, videoMetadata: { fps: 2 } },
          { fileData: { fileUri: activeFiles[1].uri, mimeType: activeFiles[1].mimeType }, videoMetadata: { fps: 2 } },
        ] }],
        config: {
          systemInstruction: EVALUATE_TAKE_INSTRUCTION,
          responseMimeType: "application/json",
          responseJsonSchema: takeEvaluationJsonSchema,
          maxOutputTokens: 4096,
          abortSignal: AbortSignal.timeout(300_000),
        },
      });
      return parseTakeEvaluation(JSON.parse(response.text || ""));
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
      throw new WorkflowError("AI_UNAVAILABLE", "AI 暂时没有完成这次检查，请稍后重新检查。", 502, { cause: error });
    } finally {
      await Promise.all(uploaded.flatMap((file) => file.name ? [this.client.files.delete({ name: file.name }).catch((error) => {
        logEvent("ai.remote_file_cleanup_failed", { provider: "gemini", model: this.config.model, fileName: file.name, error });
      })] : []));
    }
  }
}
