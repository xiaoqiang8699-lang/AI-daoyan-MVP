import "server-only";
import { WorkflowError } from "../../lib/errors";
import { KieMaterialAIProvider } from "./providers/kie-material-ai-provider";
import { MockMaterialAIProvider } from "./providers/mock-material-ai-provider";
import type { MaterialUnderstandingProvider } from "./material-ai-provider";

export function getMaterialAIConfig() {
  const provider = process.env.MATERIAL_AI_PROVIDER || "mock";
  if (provider !== "mock" && provider !== "kie") throw new WorkflowError("AI_CONFIGURATION", "素材分析服务配置有误。", 503);
  return { provider, model: provider === "kie" ? process.env.KIE_MATERIAL_MODEL || process.env.KIE_VIDEO_MODEL || "gemini-3-8-flash" : null };
}
export function getMaterialAIProvider(): MaterialUnderstandingProvider {
  const config = getMaterialAIConfig();
  console.info(`Material AI Provider: ${config.provider.toUpperCase()}\nMaterial Model: ${config.model || "local-mock"}`);
  if (config.provider === "mock") return new MockMaterialAIProvider();
  if (!process.env.KIE_API_KEY) throw new WorkflowError("AI_NOT_CONFIGURED", "素材分析服务尚未配置完成。", 503);
  return new KieMaterialAIProvider({ apiKey: process.env.KIE_API_KEY, model: config.model! });
}
