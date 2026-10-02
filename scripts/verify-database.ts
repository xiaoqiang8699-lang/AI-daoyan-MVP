import "dotenv/config";
import assert from "node:assert/strict";
import { db } from "../lib/db";

async function main() {
  const project = await db.project.findUniqueOrThrow({ where: { id: "demo-project" }, include: { user: true, referenceVideo: true, shots: { orderBy: { order: "asc" } }, shootingPlan: { include: { shots: true } } } });
  assert.equal(project.user.id, "demo-user");
  assert.ok(project.referenceVideo);
  assert.equal(project.shots.length, 5);
  assert.deepEqual(project.shots.map((shot) => shot.order), [1, 2, 3, 4, 5]);

  // 所有约束测试都在事务中回滚，不留下测试素材。
  const rollback = new Error("ROLLBACK_VERIFICATION");
  await assert.rejects(db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SAVEPOINT duplicate_reference");
    await assert.rejects(tx.referenceVideo.create({ data: { projectId: project.id, fileUrl: "/duplicate", duration: 20 } }));
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT duplicate_reference");
    await tx.$executeRawUnsafe("SAVEPOINT duplicate_shot");
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...shot } = project.shots[0];
    void _id; void _createdAt; void _updatedAt;
    await assert.rejects(tx.shot.create({ data: shot }));
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT duplicate_shot");

    let plannedShot = project.shootingPlan?.shots[0];
    if (!plannedShot) {
      const brief = await tx.shootingBrief.upsert({ where: { projectId: project.id }, create: { projectId: project.id, subject: "测试", talentMode: "SELF", location: "室内" }, update: {} });
      const plan = await tx.shootingPlan.upsert({ where: { projectId: project.id }, create: { projectId: project.id, briefId: brief.id, status: "READY" }, update: {} });
      plannedShot = await tx.plannedShot.create({ data: { shootingPlanId: plan.id, referenceShotId: project.shots[0].id, order: 1, purpose: "验证", actionInstruction: "完成动作。", cameraInstruction: "固定手机。", targetDuration: 4, difficulty: "EASY" } });
    }
    const take = await tx.take.create({ data: { plannedShotId: plannedShot.id, videoUrl: "/test-take", duration: 4, width: 1080, height: 1920, mimeType: "video/mp4", fileSize: 1024 } });
    for (const score of [-1, 101]) {
      await tx.$executeRawUnsafe("SAVEPOINT invalid_score");
      await assert.rejects(tx.evaluation.create({ data: { takeId: take.id, passed: false, score, advice: "固定手机。", rawResult: {} } }));
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT invalid_score");
    }
    await tx.evaluation.create({ data: { takeId: take.id, passed: true, score: 86, advice: "这条可以使用。", rawResult: { passed: true, score: 86 } } });
    await tx.plannedShot.update({ where: { id: take.plannedShotId! }, data: { selectedTakeId: take.id, captureStatus: "CAPTURED" } });
    throw rollback;
  }), (error) => error === rollback);
  console.log("数据库验证通过：示例项目、五镜头、参考视频唯一性、镜头排序唯一性、评分范围和 PlannedShot 素材关系。");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
