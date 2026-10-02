import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { db } from "../../lib/db";
import { ensureDemoUser, DEMO_USER_ID } from "../../lib/demo-user";
import { generateProjectShootingPlan, regenerateProjectPlannedShot, saveShootingBrief } from "../../lib/shooting-plan";
import type { GenerateShootingPlanInput, PlannedShotPlan, RegeneratePlannedShotInput } from "../../packages/ai/types";
import type { VideoAIProvider } from "../../packages/ai/video-ai-provider";

function planned(input: GenerateShootingPlanInput, suffix = "初版"): PlannedShotPlan[] {
  return input.referenceShots.map((shot) => ({
    referenceShotId: shot.id,
    order: shot.order,
    purpose: `作用 ${shot.order}`,
    actionInstruction: `${suffix}动作 ${shot.order}`,
    cameraInstruction: `机位 ${shot.order}`,
    dialogue: null,
    targetDuration: shot.targetDuration,
    difficulty: "EASY",
    notes: null,
  }));
}

function provider(options: { failPlan?: boolean; failShot?: boolean; planSuffix?: string } = {}): VideoAIProvider {
  return {
    async analyzeReferenceVideo() { throw new Error("unused"); },
    async generateShootingPlan(input) { if (options.failPlan) throw new Error("plan failure"); return planned(input, options.planSuffix || "初版"); },
    async regeneratePlannedShot(input: RegeneratePlannedShotInput) { if (options.failShot) throw new Error("shot failure"); return planned(input, "替代")[0]; },
    async evaluateTake() { throw new Error("unused"); },
  };
}

test("需求可更新；方案完整关联；失败保留旧方案；单镜替换不影响其他镜头", async () => {
  await ensureDemoUser();
  const project = await db.project.create({ data: {
    userId: DEMO_USER_ID,
    name: `shooting-plan-${randomUUID()}`,
    status: "READY_TO_SHOOT",
    referenceVideo: { create: { fileUrl: "/mock/reference.svg", duration: 6 } },
    shots: { create: [1, 2, 3].map((order) => ({
      order,
      startTime: (order - 1) * 2,
      endTime: order * 2,
      targetDuration: 2,
      shotSize: "近景",
      cameraMovement: "固定",
      visualDescription: `参考画面 ${order}`,
      actionInstruction: `旧建议 ${order}`,
      cameraInstruction: `旧机位 ${order}`,
      status: "READY",
    })) },
  } });
  try {
    const firstBrief = await saveShootingBrief(project.id, { subject: "针织衫", talentMode: "SELF", location: "服装店", additionalContext: null });
    const updatedBrief = await saveShootingBrief(project.id, { subject: "秋季针织开衫", talentMode: "SELF", location: "自己的服装店", additionalContext: "一个人完成" });
    assert.equal(updatedBrief.id, firstBrief.id);
    assert.equal(updatedBrief.subject, "秋季针织开衫");

    const result = await generateProjectShootingPlan(project.id, { provider: provider() });
    assert.equal(result.shotCount, 3);
    const ready = await db.shootingPlan.findUniqueOrThrow({ where: { projectId: project.id }, include: { shots: { orderBy: { order: "asc" } } } });
    assert.equal(ready.status, "READY");
    assert.deepEqual(ready.shots.map((shot) => shot.order), [1, 2, 3]);
    assert.equal(new Set(ready.shots.map((shot) => shot.referenceShotId)).size, 3);

    const regenerated = await generateProjectShootingPlan(project.id, { provider: provider({ planSuffix: "重生" }) });
    assert.equal(regenerated.shotCount, 3);
    const replaced = await db.shootingPlan.findUniqueOrThrow({ where: { projectId: project.id }, include: { shots: { orderBy: { order: "asc" } } } });
    assert.ok(replaced.shots.every((shot) => shot.actionInstruction.startsWith("重生")));
    const beforeFailure = replaced.shots.map((shot) => ({ id: shot.id, action: shot.actionInstruction }));
    await assert.rejects(generateProjectShootingPlan(project.id, { provider: provider({ failPlan: true }) }));
    const afterFailure = await db.shootingPlan.findUniqueOrThrow({ where: { projectId: project.id }, include: { shots: { orderBy: { order: "asc" } } } });
    assert.equal(afterFailure.status, "READY");
    assert.deepEqual(afterFailure.shots.map((shot) => ({ id: shot.id, action: shot.actionInstruction })), beforeFailure);

    const target = afterFailure.shots[1];
    await regenerateProjectPlannedShot(project.id, target.id, "换个角度", { provider: provider() });
    const afterSingle = await db.shootingPlan.findUniqueOrThrow({ where: { projectId: project.id }, include: { shots: { orderBy: { order: "asc" } } } });
    assert.equal(afterSingle.shots[1].actionInstruction, "替代动作 2");
    assert.equal(afterSingle.shots[0].actionInstruction, beforeFailure[0].action);
    assert.equal(afterSingle.shots[2].actionInstruction, beforeFailure[2].action);

    const stable = afterSingle.shots.map((shot) => shot.actionInstruction);
    await assert.rejects(regenerateProjectPlannedShot(project.id, target.id, null, { provider: provider({ failShot: true }) }));
    const afterSingleFailure = await db.plannedShot.findMany({ where: { shootingPlanId: ready.id }, orderBy: { order: "asc" } });
    assert.deepEqual(afterSingleFailure.map((shot) => shot.actionInstruction), stable);
  } finally {
    await db.project.delete({ where: { id: project.id } });
  }
});
