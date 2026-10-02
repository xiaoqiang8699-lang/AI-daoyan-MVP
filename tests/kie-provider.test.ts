import assert from "node:assert/strict";
import { test } from "node:test";
import { KieVideoAIProvider } from "../packages/ai/providers/kie-video-ai-provider";

test("KIE Provider 使用临时视频 URL 和 JSON Schema，并解析镜头", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const providerShot = { order: 1, startTime: 0, endTime: 1, targetDuration: 1, shotSize: "近景", cameraMovement: "固定", visualDescription: "一只手拿起杯子。", actionInstruction: "伸手拿起杯子。", cameraInstruction: "手机放在杯子侧面，保持不动。", dialogue: "" };
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return new Response(JSON.stringify({ success: true, code: 200, data: { downloadUrl: "https://temp.example/video.mp4" } }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ shots: [providerShot] }) } }] }), { status: 200 });
  };
  const provider = new KieVideoAIProvider({ apiKey: "test-only", model: "gemini-3-8-flash" }, fakeFetch);
  const shots = await provider.analyzeReferenceVideo({ fileUrl: "/file", duration: 1, localFilePath: "test-results/reference-pixel8.mp4", mimeType: "video/mp4" });
  assert.deepEqual(shots, [{ ...providerShot, dialogue: null }]);
  assert.match(calls[0].url, /file-stream-upload/);
  assert.match(calls[1].url, /gemini-3-8-flash-openai/);
  const request = JSON.parse(String(calls[1].init?.body));
  assert.equal(request.messages[1].content[1].image_url.url, "https://temp.example/video.mp4");
  assert.equal(request.response_format.type, "json_schema");
  assert.equal(request.response_format.json_schema.strict, true);
  assert.equal(request.response_format.json_schema.schema.properties.shots.items.properties.dialogue.type, "string");
});

test("KIE Provider 使用参考事实生成结构化用户方案，不重新上传视频", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const shot = { referenceShotId: "reference-1", order: 1, purpose: "展示版型", actionInstruction: "穿上针织衫转身。", cameraInstruction: "把手机放在货架上固定拍摄。", dialogue: "这件很显瘦。", targetDuration: 2, difficulty: "EASY", notes: "" };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ shots: [shot] }) } }] }), { status: 200 });
  };
  const provider = new KieVideoAIProvider({ apiKey: "test-only", model: "gemini-3-8-flash" }, fakeFetch);
  const input = {
    project: { id: "project", name: "针织衫" },
    brief: { subject: "秋季针织开衫", talentMode: "SELF" as const, location: "服装店", goal: "改成我的版本", additionalContext: "一个人拍" },
    referenceVideo: { duration: 2, width: 1280, height: 720, fps: 30, codec: "h264" },
    referenceShots: [{ id: "reference-1", order: 1, startTime: 0, endTime: 2, targetDuration: 2, shotSize: "中景", cameraMovement: "固定", visualDescription: "人物走过街道。", dialogue: null }],
  };
  const shots = await provider.generateShootingPlan(input);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /chat\/completions/);
  assert.equal(shots[0].notes, null);
  assert.match(shots[0].actionInstruction, /针织衫/);
  const request = JSON.parse(String(calls[0].init?.body));
  assert.equal(request.response_format.json_schema.schema.properties.shots.minItems, 1);
  assert.doesNotMatch(JSON.stringify(request.messages), /actionInstruction.*旧/);
});

test("KIE Provider 同时上传 Reference Clip 和 User Take，并使用严格五维 Structured Output", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const evaluation = {
    passed: false,
    overallScore: 58,
    dimensions: { framing: 82, action: 40, movement: 75, timing: 48, visibility: 88 },
    criticalIssues: ["ACTION_INCOMPLETE", "CAMERA_SHAKE_OR_UNSTABLE"],
    mainIssue: "没有完成转身动作。",
    advice: "完整转到侧身后停半秒再结束录制。",
    confidence: 0.91,
    evidence: "视频结束时人物仍面向镜头。",
    issueStartTime: 1,
    issueEndTime: 2,
  };
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("file-stream-upload")) return new Response(JSON.stringify({ success: true, code: 200, data: { downloadUrl: `https://temp.example/video-${calls.length}.mp4` } }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(evaluation) } }] }), { status: 200 });
  };
  const provider = new KieVideoAIProvider({ apiKey: "test-only", model: "gemini-3-8-flash" }, fakeFetch);
  const result = await provider.evaluateTake({
    referenceShot: { visualDescription: "人物转身", shotSize: "中景", cameraMovement: "固定", targetDuration: 2 },
    plannedShot: { purpose: "展示侧身", actionInstruction: "完整转到侧身", cameraInstruction: "固定手机", dialogue: null, targetDuration: 2 },
    take: { videoUrl: "/take.mp4", localFilePath: "test-results/reference-pixel8.mp4", mimeType: "video/mp4", duration: 2, width: 640, height: 480 },
    referenceClip: { localFilePath: "test-results/reference-pixel8.mp4", mimeType: "video/mp4" },
    deterministicChecks: { fileValid: true, takeDuration: 2, targetDuration: 2, durationRatio: 1, takeOrientation: "LANDSCAPE", referenceOrientation: "LANDSCAPE", orientationMatch: true, warnings: [] },
  });
  assert.deepEqual(result.criticalIssues, ["KEY_ACTION_MISSING", "UNUSABLE_VISIBILITY"]);
  assert.equal(typeof result.providerMetadata?.uploadMs, "number");
  assert.equal(typeof result.providerMetadata?.evaluationMs, "number");
  assert.equal(calls.filter((call) => call.url.includes("file-stream-upload")).length, 2);
  const chat = calls.find((call) => call.url.includes("chat/completions"));
  assert.ok(chat);
  const body = JSON.parse(String(chat.init?.body));
  assert.equal(body.messages[1].content.filter((item: { type: string }) => item.type === "image_url").length, 2);
  assert.equal(body.response_format.json_schema.strict, true);
  assert.deepEqual(body.response_format.json_schema.schema.properties.criticalIssues.items.enum, ["SUBJECT_MISSING", "KEY_ACTION_MISSING", "PRODUCT_NOT_VISIBLE", "SEVERELY_OUT_OF_FRAME", "UNUSABLE_VISIBILITY", "WRONG_SHOT_CONTENT"]);
});
