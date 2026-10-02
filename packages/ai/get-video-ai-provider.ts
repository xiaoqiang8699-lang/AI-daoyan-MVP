import "server-only";
import { WorkflowError } from "../../lib/errors";
import { getTakeEvaluationConfig, getVideoAIConfig } from "./config";
import { GeminiVideoAIProvider } from "./providers/gemini-video-ai-provider";
import { MockVideoAIProvider } from "./providers/mock-video-ai-provider";
import { KieVideoAIProvider } from "./providers/kie-video-ai-provider";
import type { VideoAIProvider } from "./video-ai-provider";

export function getVideoAIProvider(): VideoAIProvider {
  const config = getVideoAIConfig();
  if (config.provider === "mock") return new MockVideoAIProvider();
  if (config.provider === "kie") {
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) throw new WorkflowError("AI_NOT_CONFIGURED", "分析服务尚未配置完成，请联系管理员后重试。", 503);
    return new KieVideoAIProvider({ apiKey, model: config.model! });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new WorkflowError("AI_NOT_CONFIGURED", "分析服务尚未配置完成，请联系管理员后重试。", 503);
  return new GeminiVideoAIProvider({ apiKey, model: config.model! });
}

export function getTakeEvaluationProvider(): VideoAIProvider {
  const config = getTakeEvaluationConfig();
  if (config.provider === "mock") return new MockVideoAIProvider();
  if (config.provider === "kie") {
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) throw new WorkflowError("AI_NOT_CONFIGURED", "镜头检查服务尚未配置完成，请联系管理员后重试。", 503);
    return new KieVideoAIProvider({ apiKey, model: config.model!, uploadAuditPath: process.env.KIE_UPLOAD_AUDIT_PATH });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new WorkflowError("AI_NOT_CONFIGURED", "镜头检查服务尚未配置完成，请联系管理员后重试。", 503);
  return new GeminiVideoAIProvider({ apiKey, model: config.model! });
}
