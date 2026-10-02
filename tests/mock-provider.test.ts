import assert from "node:assert/strict";
import { test } from "node:test";
import { MockVideoAIProvider } from "../packages/ai/providers/mock-video-ai-provider";

test("示例分析包含五个连续、可执行的镜头，调用之间不共享可变数据", async () => {
  const provider = new MockVideoAIProvider();
  const input = { fileUrl: "/mock/reference.svg", duration: 20 };
  const shots = await provider.analyzeReferenceVideo(input);
  assert.equal(shots.length, 5);
  shots.forEach((shot, index) => {
    assert.equal(shot.order, index + 1);
    assert.equal(shot.endTime - shot.startTime, shot.targetDuration);
    assert.equal(shot.startTime, index ? shots[index - 1].endTime : 0);
    assert.ok(shot.actionInstruction && shot.cameraInstruction && shot.visualDescription);
  });
  shots[0].actionInstruction = "被修改的数据";
  assert.notEqual((await provider.analyzeReferenceVideo(input))[0].actionInstruction, shots[0].actionInstruction);
});

test("评价支持规定的通过结果与单条建议的失败结果", async () => {
  const provider = new MockVideoAIProvider();
  const [shot] = await provider.analyzeReferenceVideo({ fileUrl: "reference", duration: 20 });
  const input = {
    referenceShot: { visualDescription: shot.visualDescription, shotSize: shot.shotSize, cameraMovement: shot.cameraMovement, targetDuration: shot.targetDuration },
    plannedShot: { purpose: "展示杯子", actionInstruction: shot.actionInstruction, cameraInstruction: shot.cameraInstruction, dialogue: shot.dialogue || null, targetDuration: shot.targetDuration },
    take: { videoUrl: "take", localFilePath: "take.mp4", mimeType: "video/mp4", duration: 4, width: 1080, height: 1920 },
    referenceClip: { localFilePath: "reference.mp4", mimeType: "video/mp4" as const },
    deterministicChecks: { fileValid: true, takeDuration: 4, targetDuration: 4, durationRatio: 1, takeOrientation: "PORTRAIT" as const, referenceOrientation: "PORTRAIT" as const, orientationMatch: true, warnings: [] },
  };
  const passed = await provider.evaluateTake(input);
  assert.equal(passed.passed, true);
  assert.equal(passed.overallScore, 86);
  const failed = await new MockVideoAIProvider("rejected").evaluateTake(input);
  assert.equal(failed.passed, false);
  assert.ok(Number.isInteger(failed.overallScore) && failed.overallScore >= 0 && failed.overallScore <= 100);
  assert.ok(failed.mainIssue);
  assert.equal(typeof failed.advice, "string");
});

test("示例 Provider 按参考镜头生成用户方案", async () => {
  const provider = new MockVideoAIProvider();
  const referenceShots = (await provider.analyzeReferenceVideo({ fileUrl: "reference", duration: 20 })).map((shot, index) => ({ ...shot, dialogue: shot.dialogue || null, id: `reference-${index + 1}` }));
  const input = {
    project: { id: "project", name: "针织衫" },
    brief: { subject: "秋季针织开衫", talentMode: "SELF" as const, location: "自己的服装店", goal: "改成我的版本", additionalContext: "一个人用手机完成" },
    referenceVideo: { duration: 20, width: 1280, height: 720, fps: 30, codec: "h264" },
    referenceShots,
  };
  const plan = await provider.generateShootingPlan(input);
  assert.equal(plan.length, referenceShots.length);
  assert.deepEqual(plan.map((shot) => shot.referenceShotId), referenceShots.map((shot) => shot.id));
  assert.ok(plan.every((shot) => shot.actionInstruction.includes("秋季针织开衫")));
  const changed = await provider.regeneratePlannedShot({ ...input, referenceShots: [referenceShots[0]], currentShot: plan[0], reason: "换个角度" });
  assert.equal(changed.referenceShotId, referenceShots[0].id);
  assert.notEqual(changed.actionInstruction, plan[0].actionInstruction);
});
