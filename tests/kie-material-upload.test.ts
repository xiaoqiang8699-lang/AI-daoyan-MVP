import test from "node:test";
import assert from "node:assert/strict";
import { extractKieAssistantText, extractKieUploadedMediaUrl, materialAnalysisSchema } from "../packages/ai/providers/kie-material-ai-provider";

test("KIE upload response prefers downloadUrl", () => assert.equal(extractKieUploadedMediaUrl({ success: true, data: { downloadUrl: "https://example.com/download.png", fileUrl: "https://example.com/file.png" } }), "https://example.com/download.png"));
test("KIE upload response accepts fileUrl fallback", () => assert.equal(extractKieUploadedMediaUrl({ success: true, data: { fileUrl: "http://example.com/file.png" } }), "http://example.com/file.png"));
test("KIE upload response rejects missing URL", () => assert.throws(() => extractKieUploadedMediaUrl({ success: true, data: {} }), { code: "INVALID_UPLOAD_RESPONSE" }));
test("KIE assistant parser reads OpenAI choices", () => assert.equal(extractKieAssistantText({ choices: [{ message: { content: "{\"summary\":\"test\"}" } }] }), "{\"summary\":\"test\"}"));
test("KIE assistant parser reads Gemini candidates", () => assert.equal(extractKieAssistantText({ candidates: [{ content: { parts: [{ text: "{\"summary\":\"test\"}" }] } }] }), "{\"summary\":\"test\"}"));
test("KIE assistant parser rejects unsupported response", () => assert.throws(() => extractKieAssistantText({ foo: "bar" }), { code: "PROVIDER_INVALID_RESPONSE" }));

const validMaterial = { summary: "一件开衫挂在衣架上。", scene: "单品展示", activity: "服装展示", objects: ["开衫", "衣架"], topics: ["服装展示"], speechSummary: null, visualQuality: "GOOD", storyPotential: 60, confidence: 0.9 };
test("完整 Material Schema 接受合法对象", () => assert.equal(materialAnalysisSchema.safeParse(validMaterial).success, true));
test("完整 Material Schema 拒绝缺少 summary", () => { const { summary, ...value } = validMaterial; assert.equal(materialAnalysisSchema.safeParse(value).success, false); });
test("完整 Material Schema 拒绝越界 confidence", () => assert.equal(materialAnalysisSchema.safeParse({ ...validMaterial, confidence: 1.01 }).success, false));
test("完整 Material Schema 拒绝非法 visualQuality", () => assert.equal(materialAnalysisSchema.safeParse({ ...validMaterial, visualQuality: "EXCELLENT" }).success, false));
test("完整 Material Schema 拒绝错误的 objects/topics 类型", () => assert.equal(materialAnalysisSchema.safeParse({ ...validMaterial, objects: "开衫", topics: "服装展示" }).success, false));
