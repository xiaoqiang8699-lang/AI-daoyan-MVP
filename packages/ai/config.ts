import "server-only";
import { WorkflowError } from "../../lib/errors";

export function getVideoAIConfig() {
  const provider = process.env.VIDEO_AI_PROVIDER || "kie";
  if (!["mock", "gemini", "kie"].includes(provider)) throw new WorkflowError("AI_CONFIGURATION", "分析服务配置有误，请联系管理员。", 503);
  const model = provider === "kie" ? process.env.KIE_VIDEO_MODEL || "gemini-3-8-flash"
    : provider === "gemini" ? process.env.GEMINI_VIDEO_MODEL || "gemini-3.8-flash" : null;
  return { provider, model };
}

export function getTakeEvaluationConfig() {
  const provider = process.env.TAKE_EVALUATION_PROVIDER || process.env.VIDEO_AI_PROVIDER || "kie";
  if (!["mock", "gemini", "kie"].includes(provider)) throw new WorkflowError("AI_CONFIGURATION", "镜头检查服务配置有误，请联系管理员。", 503);
  const model = provider === "kie" ? process.env.KIE_TAKE_EVALUATION_MODEL || process.env.KIE_VIDEO_MODEL || "gemini-3-8-flash"
    : provider === "gemini" ? process.env.GEMINI_TAKE_EVALUATION_MODEL || process.env.GEMINI_VIDEO_MODEL || "gemini-3.8-flash" : null;
  return { provider, model };
}
