import "server-only";
import { WorkflowError } from "./errors";
import { KieEnhancementProvider } from "../packages/ai/providers/kie-enhancement-provider";
import { LocalWhisperProvider } from "../packages/ai/providers/local-whisper-provider";
import { MockFinalQAProvider } from "../packages/ai/final-qa-provider";
import { MockSpeechToTextProvider } from "../packages/ai/speech-to-text-provider";

function config(kind: "SPEECH_TO_TEXT_PROVIDER" | "FINAL_QA_PROVIDER") { const fallback = kind === "SPEECH_TO_TEXT_PROVIDER" ? "local" : "mock"; const provider = process.env[kind] || fallback; const supported = kind === "SPEECH_TO_TEXT_PROVIDER" ? ["mock", "kie", "local"] : ["mock", "kie"]; if (!supported.includes(provider)) throw new WorkflowError("AI_CONFIGURATION", "增强服务配置有误。", 503); const model = process.env[`${kind}_MODEL`] || (provider === "local" ? process.env.LOCAL_WHISPER_MODEL || "base" : process.env.KIE_VIDEO_MODEL || "gemini-3-8-flash"); return { provider, model }; }
export function getSpeechToTextProvider() { const value = config("SPEECH_TO_TEXT_PROVIDER"); if (value.provider === "mock") return { provider: new MockSpeechToTextProvider(), config: value }; if (value.provider === "local") return { provider: new LocalWhisperProvider({ model: value.model }), config: value }; const apiKey = process.env.KIE_API_KEY; if (!apiKey) throw new WorkflowError("AI_NOT_CONFIGURED", "字幕服务尚未配置。", 503); return { provider: new KieEnhancementProvider({ apiKey, model: value.model }), config: value }; }
export function getFinalQAProvider() { const value = config("FINAL_QA_PROVIDER"); if (value.provider === "mock") return { provider: new MockFinalQAProvider(), config: value }; const apiKey = process.env.KIE_API_KEY; if (!apiKey) throw new WorkflowError("AI_NOT_CONFIGURED", "成片检查服务尚未配置。", 503); return { provider: new KieEnhancementProvider({ apiKey, model: value.model }), config: value }; }
