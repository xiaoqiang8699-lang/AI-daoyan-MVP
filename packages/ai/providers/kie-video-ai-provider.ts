import "server-only";
import { openAsBlob } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WorkflowError } from "../../../lib/errors";
import { ANALYZE_REFERENCE_INSTRUCTION, analysisPrompt } from "../prompts/analyze-reference";
import { GENERATE_PLAN_INSTRUCTION, regenerateShotPrompt, shootingPlanPrompt } from "../prompts/generate-shooting-plan";
import { EVALUATE_TAKE_INSTRUCTION, evaluateTakePrompt } from "../prompts/evaluate-take";
import { EVALUATE_CAPTURE_TASK_INSTRUCTION, evaluateCaptureTaskPrompt } from "../prompts/evaluate-capture-task";
import { TRIM_TAKE_INSTRUCTION, trimTakePrompt } from "../prompts/trim-take";
import { validatePlannedShots } from "../planned-shot-schema";
import { parseShotPlans } from "../shot-schema";
import { parseTakeEvaluation, takeEvaluationJsonSchema } from "../take-evaluation-schema";
import { takeTrimJsonSchema, takeTrimSchema } from "../take-trim-schema";
import type { AnalyzeReferenceInput, EvaluateTakeInput, EvaluateTaskOnlyInput, GenerateShootingPlanInput, PlannedShotPlan, RegeneratePlannedShotInput, SelectTakeTrimInput, ShotPlan, TakeEvaluation, TakeTrim } from "../types";
import type { VideoAIProvider } from "../video-ai-provider";

const kieShotPlansJsonSchema = {
  type: "array",
  minItems: 1,
  maxItems: 200,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["order", "startTime", "endTime", "targetDuration", "shotSize", "cameraMovement", "visualDescription", "actionInstruction", "cameraInstruction", "dialogue"],
    properties: {
      order: { type: "integer", minimum: 1 },
      startTime: { type: "number", minimum: 0 },
      endTime: { type: "number", exclusiveMinimum: 0 },
      targetDuration: { type: "number", exclusiveMinimum: 0 },
      shotSize: { type: "string", minLength: 1, maxLength: 100 },
      cameraMovement: { type: "string", minLength: 1, maxLength: 200 },
      visualDescription: { type: "string", minLength: 1, maxLength: 2000 },
      actionInstruction: { type: "string", minLength: 1, maxLength: 2000 },
      cameraInstruction: { type: "string", minLength: 1, maxLength: 2000 },
      dialogue: { type: "string", maxLength: 4000 },
    },
  },
} as const;

const kiePlannedShotJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["referenceShotId", "order", "purpose", "actionInstruction", "cameraInstruction", "dialogue", "targetDuration", "difficulty", "notes"],
  properties: {
    referenceShotId: { type: "string", minLength: 1 },
    order: { type: "integer", minimum: 1 },
    purpose: { type: "string", minLength: 1, maxLength: 300 },
    actionInstruction: { type: "string", minLength: 1, maxLength: 2000 },
    cameraInstruction: { type: "string", minLength: 1, maxLength: 2000 },
    dialogue: { type: "string", maxLength: 1000 },
    targetDuration: { type: "number", exclusiveMinimum: 0 },
    difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
    notes: { type: "string", maxLength: 1000 },
  },
} as const;

type KieUploadedFile = {
  url: string;
  fileId: string | null;
  uploadedAt: string;
  expiresAt: string | null;
};

const criticalIssueAliases: Record<string, string> = {
  SUBJECT_OCCLUDED: "UNUSABLE_VISIBILITY",
  LOW_VISIBILITY: "UNUSABLE_VISIBILITY",
  POOR_VISIBILITY: "UNUSABLE_VISIBILITY",
  CAMERA_SHAKE: "UNUSABLE_VISIBILITY",
  EXCESSIVE_CAMERA_SHAKE: "UNUSABLE_VISIBILITY",
  UNSTABLE_CAMERA: "UNUSABLE_VISIBILITY",
  CAMERA_SHAKE_OR_UNSTABLE: "UNUSABLE_VISIBILITY",
  UNWANTED_CAMERA_MOVEMENT: "UNUSABLE_VISIBILITY",
  PRODUCT_MISSING: "PRODUCT_NOT_VISIBLE",
  PRODUCT_NOT_SHOWN: "PRODUCT_NOT_VISIBLE",
  ACTION_MISSING: "KEY_ACTION_MISSING",
  ACTION_INCOMPLETE: "KEY_ACTION_MISSING",
  SUBJECT_OUT_OF_FRAME: "SEVERELY_OUT_OF_FRAME",
  OUT_OF_FRAME: "SEVERELY_OUT_OF_FRAME",
  WRONG_CONTENT: "WRONG_SHOT_CONTENT",
  CONTENT_MISMATCH: "WRONG_SHOT_CONTENT",
};

export class KieVideoAIProvider implements VideoAIProvider {
  private readonly uploadCache = new Map<string, KieUploadedFile>();
  constructor(private readonly config: { apiKey: string; model: string; uploadAuditPath?: string }, private readonly request: typeof fetch = fetch) {}

  private async post(url: string, body: BodyInit, json = false, networkRetries = 0) {
    let response: Response | undefined;
    for (let attempt = 0; attempt <= networkRetries; attempt += 1) {
      try {
        response = await this.request(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.config.apiKey}`, ...(json ? { "Content-Type": "application/json" } : {}) },
          body,
          signal: AbortSignal.timeout(300_000),
          redirect: "error",
        });
        break;
      } catch (error) {
        if (attempt === networkRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    if (!response) throw new WorkflowError("KIE_REQUEST_FAILED", "AI 服务暂时不可用，请稍后重试。", 502);
    const text = await response.text();
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403 ? "分析服务授权失败，请联系管理员。"
        : response.status === 429 || response.status === 402 ? "分析服务繁忙或额度不足，请稍后重试。" : "AI 服务暂时不可用，请稍后重新分析。";
      throw new WorkflowError("KIE_REQUEST_FAILED", message, 502, { cause: new Error(`KIE HTTP ${response.status}: ${text.slice(0,2000)}`) });
    }
    let result;
    try { result = JSON.parse(text); }
    catch (error) { throw new WorkflowError("AI_PARSE_FAILED", "AI 返回的数据无法解析，请重新分析。", 422, { cause: error }); }
    if (result.error || result.success === false || (typeof result.code === "number" && result.code !== 200)) {
      throw new WorkflowError("KIE_REQUEST_FAILED", "AI 服务未能完成请求，请稍后重试。", 502, { cause: new Error(JSON.stringify(result).slice(0, 2000)) });
    }
    return result;
  }

  private async uploadLocalFile(localFilePath: string, mimeType: string, uploadPath: string): Promise<KieUploadedFile> {
    const cacheKey = `${localFilePath}\0${mimeType}\0${uploadPath}`;
    const cached = this.uploadCache.get(cacheKey);
    if (cached) return cached;
    const extension = mimeType === "video/quicktime" ? "mov" : mimeType === "video/webm" ? "webm" : "mp4";
    const form = new FormData();
    form.append("file", await openAsBlob(localFilePath, { type: mimeType }), `${randomUUID()}.${extension}`);
    form.append("uploadPath", uploadPath);
    const uploaded = await this.post("https://kieai.redpandaai.co/api/file-stream-upload", form);
    const mediaUrl = uploaded.data?.downloadUrl;
    if (typeof mediaUrl !== "string" || !mediaUrl.startsWith("https://")) throw new WorkflowError("AI_UPLOAD_FAILED", "分析服务未能接收视频，请稍后重试。", 502);
    const result = {
      url: mediaUrl,
      fileId: typeof uploaded.data?.fileId === "string" ? uploaded.data.fileId : null,
      uploadedAt: typeof uploaded.data?.uploadedAt === "string" ? uploaded.data.uploadedAt
        : typeof uploaded.data?.uploadTime === "string" ? uploaded.data.uploadTime : new Date().toISOString(),
      expiresAt: typeof uploaded.data?.expiresAt === "string" ? uploaded.data.expiresAt : null,
    };
    if (this.config.uploadAuditPath) {
      await appendFile(this.config.uploadAuditPath, `${JSON.stringify({
        localFile: path.basename(localFilePath),
        uploadPath,
        ...result,
        deletionStatus: "NOT_SUPPORTED",
      })}\n`, "utf8");
    }
    this.uploadCache.set(cacheKey, result);
    return result;
  }

  async analyzeReferenceVideo(input: AnalyzeReferenceInput): Promise<ShotPlan[]> {
    if (!input.localFilePath || !input.mimeType) throw new WorkflowError("REFERENCE_MISSING", "没有找到已上传的视频。", 422);
    if (!/^[a-z0-9.-]+$/.test(this.config.model)) throw new WorkflowError("AI_CONFIGURATION", "分析服务配置有误，请联系管理员。", 503);
    try {
      const uploadedFile = await this.uploadLocalFile(input.localFilePath, input.mimeType, "ai-director/reference");
      const response = await this.post(`https://api.kie.ai/${this.config.model}-openai/v1/chat/completions`, JSON.stringify({
        model: this.config.model,
        stream: false,
        messages: [
          { role: "system", content: ANALYZE_REFERENCE_INSTRUCTION + "将镜头数组放入 shots 字段。为接口兼容，没有台词时 dialogue 返回空字符串。" },
          { role: "user", content: [{ type: "text", text: analysisPrompt(input.duration) }, { type: "image_url", image_url: { url: uploadedFile.url } }] },
        ],
        response_format: { type: "json_schema", json_schema: { name: "shot_plan", strict: true, schema: {
          type: "object", properties: { shots: kieShotPlansJsonSchema }, required: ["shots"], additionalProperties: false,
        } } },
      }), true);
      const content = response.choices?.[0]?.message?.content
        ?? response.candidates?.[0]?.content?.parts?.filter((part: { text?: string; thought?: boolean }) => !part.thought && typeof part.text === "string").map((part: { text: string }) => part.text).join("");
      if (typeof content !== "string") throw new WorkflowError("AI_PARSE_FAILED", "AI 没有返回可用的拍摄步骤，请重新分析。", 422);
      let data;
      try { data = JSON.parse(content); }
      catch (error) { throw new WorkflowError("AI_PARSE_FAILED", "AI 返回的数据无法解析，请重新分析。", 422, { cause: error }); }
      const shots = Array.isArray(data.shots)
        ? data.shots.map((shot: unknown) => {
            if (!shot || typeof shot !== "object") return shot;
            const dialogue = (shot as { dialogue?: unknown }).dialogue;
            return { ...shot, dialogue: typeof dialogue === "string" && dialogue.trim() ? dialogue.trim() : null };
          })
        : data.shots;
      return parseShotPlans(JSON.stringify(shots), input.duration);
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
      throw new WorkflowError("AI_UNAVAILABLE", "AI 服务暂时不可用或请求超时，请稍后重新分析。", 502, { cause: error });
    }
  }

  private async requestShootingPlan(input: GenerateShootingPlanInput, prompt: string) {
    if (!/^[a-z0-9.-]+$/.test(this.config.model)) throw new WorkflowError("AI_CONFIGURATION", "生成服务配置有误，请联系管理员。", 503);
    try {
      const count = input.referenceShots.length;
      const response = await this.post(`https://api.kie.ai/${this.config.model}-openai/v1/chat/completions`, JSON.stringify({
        model: this.config.model,
        stream: false,
        messages: [
          { role: "system", content: `${GENERATE_PLAN_INSTRUCTION}\n将镜头数组放入 shots 字段。为接口兼容，没有台词或备注时返回空字符串。` },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_schema", json_schema: { name: "shooting_plan", strict: true, schema: {
          type: "object",
          properties: { shots: { type: "array", minItems: count, maxItems: count, items: kiePlannedShotJsonSchema } },
          required: ["shots"],
          additionalProperties: false,
        } } },
      }), true);
      const content = response.choices?.[0]?.message?.content
        ?? response.candidates?.[0]?.content?.parts?.filter((part: { text?: string; thought?: boolean }) => !part.thought && typeof part.text === "string").map((part: { text: string }) => part.text).join("");
      if (typeof content !== "string") throw new WorkflowError("AI_PARSE_FAILED", "AI 没有返回可用的拍摄方案，请重新生成。", 422);
      let data;
      try { data = JSON.parse(content); }
      catch (error) { throw new WorkflowError("AI_PARSE_FAILED", "AI 返回的数据无法解析，请重新生成。", 422, { cause: error }); }
      const shots = Array.isArray(data.shots) ? data.shots.map((shot: unknown) => {
        if (!shot || typeof shot !== "object") return shot;
        const value = shot as { dialogue?: unknown; notes?: unknown };
        return {
          ...shot,
          dialogue: typeof value.dialogue === "string" && value.dialogue.trim() ? value.dialogue.trim() : null,
          notes: typeof value.notes === "string" && value.notes.trim() ? value.notes.trim() : null,
        };
      }) : data.shots;
      return validatePlannedShots(shots, input.referenceShots);
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
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
    if (!/^[a-z0-9.-]+$/.test(this.config.model)) throw new WorkflowError("AI_CONFIGURATION", "镜头检查服务配置有误，请联系管理员。", 503);
    try {
      const uploadStarted = Date.now();
      const [referenceClipUpload, takeUpload] = await Promise.all([
        this.uploadLocalFile(input.referenceClip.localFilePath, input.referenceClip.mimeType, "ai-director/evaluation/reference-clips"),
        this.uploadLocalFile(input.take.localFilePath, input.take.mimeType, "ai-director/evaluation/takes"),
      ]);
      const uploadMs = Date.now() - uploadStarted;
      const evaluationStarted = Date.now();
      const response = await this.post(`https://api.kie.ai/${this.config.model}-openai/v1/chat/completions`, JSON.stringify({
        model: this.config.model,
        stream: false,
        messages: [
          { role: "system", content: EVALUATE_TAKE_INSTRUCTION },
          { role: "user", content: [
            { type: "text", text: evaluateTakePrompt(input) },
            { type: "text", text: "第一个视频：Reference Shot 参考片段。" },
            { type: "image_url", image_url: { url: referenceClipUpload.url } },
            { type: "text", text: "第二个视频：需要评价的真实 User Take。" },
            { type: "image_url", image_url: { url: takeUpload.url } },
          ] },
        ],
        response_format: { type: "json_schema", json_schema: { name: "take_evaluation", strict: true, schema: takeEvaluationJsonSchema } },
      }), true, 2);
      const content = response.choices?.[0]?.message?.content
        ?? response.candidates?.[0]?.content?.parts?.filter((part: { text?: string; thought?: boolean }) => !part.thought && typeof part.text === "string").map((part: { text: string }) => part.text).join("");
      if (typeof content !== "string") throw new WorkflowError("AI_PARSE_FAILED", "AI 没有返回可用的镜头检查结果，请重新检查。", 422);
      let data;
      try { data = JSON.parse(content); }
      catch (error) { throw new WorkflowError("AI_PARSE_FAILED", "AI 返回的镜头检查结果无法解析，请重新检查。", 422, { cause: error }); }
      const normalizedData = data && typeof data === "object" && Array.isArray((data as { criticalIssues?: unknown }).criticalIssues)
        ? {
            ...data,
            criticalIssues: (data as { criticalIssues: unknown[] }).criticalIssues.map((issue) => typeof issue === "string" ? criticalIssueAliases[issue] || issue : issue),
          }
        : data;
      let result: TakeEvaluation;
      try { result = parseTakeEvaluation(normalizedData); }
      catch (error) {
        throw new WorkflowError("AI_PARSE_FAILED", "AI 返回的镜头检查结果不符合约定，请重新检查。", 422, {
          cause: new Error(`KIE evaluation payload: ${JSON.stringify(data)}; parse: ${error instanceof Error ? error.message : String(error)}`),
        });
      }
      return {
        ...result,
        providerMetadata: {
          uploadMs,
          evaluationMs: Date.now() - evaluationStarted,
          ...(typeof response.credits_consumed === "number" ? { creditsConsumed: response.credits_consumed } : {}),
          uploads: [
            { role: "REFERENCE_CLIP", ...referenceClipUpload, deletionStatus: "NOT_SUPPORTED" },
            { role: "USER_TAKE", ...takeUpload, deletionStatus: "NOT_SUPPORTED" },
          ],
        },
      };
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
      throw new WorkflowError("AI_UNAVAILABLE", "AI 暂时没有完成这次检查，请稍后重新检查。", 502, { cause: error });
    }
  }

  async evaluateTaskOnly(input: EvaluateTaskOnlyInput): Promise<TakeEvaluation> {
    try {
      const uploaded = await this.uploadLocalFile(input.take.localFilePath, input.take.mimeType, "ai-director/evaluation/capture-tasks");
      const response = await this.post(`https://api.kie.ai/${this.config.model}-openai/v1/chat/completions`, JSON.stringify({ model: this.config.model, stream: false,
        messages: [{ role: "system", content: EVALUATE_CAPTURE_TASK_INSTRUCTION }, { role: "user", content: [{ type: "text", text: evaluateCaptureTaskPrompt(input) }, { type: "text", text: "需要评价的真实用户 Take。" }, { type: "image_url", image_url: { url: uploaded.url } }] }],
        response_format: { type: "json_schema", json_schema: { name: "capture_task_evaluation", strict: true, schema: takeEvaluationJsonSchema } },
      }), true, 2);
      const content = response.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new WorkflowError("AI_PARSE_FAILED", "AI 没有返回可用的拍摄任务检查结果。", 422);
      const result = parseTakeEvaluation(JSON.parse(content));
      return { ...result, providerMetadata: { uploads: [{ role: "USER_TAKE", ...uploaded, deletionStatus: "NOT_SUPPORTED" }] } };
    } catch (error) { if (error instanceof WorkflowError) throw error; throw new WorkflowError("AI_UNAVAILABLE", "AI 暂时没有完成这次检查，请稍后重试。", 502, { cause: error }); }
  }

  async selectTakeTrim(input: SelectTakeTrimInput): Promise<TakeTrim> {
    if (!/^[a-z0-9.-]+$/.test(this.config.model)) throw new WorkflowError("AI_CONFIGURATION", "智能裁切服务配置有误。", 503);
    const [reference, take] = await Promise.all([
      this.uploadLocalFile(input.referenceClip.localFilePath, input.referenceClip.mimeType, "ai-director/trim/reference-clips"),
      this.uploadLocalFile(input.take.localFilePath, input.take.mimeType, "ai-director/trim/takes"),
    ]);
    const response = await this.post(`https://api.kie.ai/${this.config.model}-openai/v1/chat/completions`, JSON.stringify({ model: this.config.model, stream: false,
      messages: [{ role: "system", content: TRIM_TAKE_INSTRUCTION }, { role: "user", content: [{ type: "text", text: trimTakePrompt(input) }, { type: "text", text: "Reference Clip：" }, { type: "image_url", image_url: { url: reference.url } }, { type: "text", text: "User Take：" }, { type: "image_url", image_url: { url: take.url } }] }],
      response_format: { type: "json_schema", json_schema: { name: "take_trim", strict: true, schema: takeTrimJsonSchema } },
    }), true, 2);
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new WorkflowError("AI_PARSE_FAILED", "AI 没有返回可用的裁切结果。", 422);
    try { return takeTrimSchema.parse(JSON.parse(content)); }
    catch (error) { throw new WorkflowError("AI_PARSE_FAILED", "AI 返回的裁切结果不符合约定。", 422, { cause: error }); }
  }
}
