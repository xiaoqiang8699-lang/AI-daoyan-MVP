import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { test } from "node:test";
import { db } from "../../lib/db";
import { ensureDemoUser, DEMO_USER_ID } from "../../lib/demo-user";
import type { StorageProvider } from "../../lib/storage/storage-provider";
import { saveTakeUpload, skipPlannedShot } from "../../lib/takes";

async function createProject() {
  await ensureDemoUser();
  const project = await db.project.create({ data: {
    userId: DEMO_USER_ID,
    name: `takes-${randomUUID()}`,
    status: "READY_TO_SHOOT",
    referenceVideo: { create: { fileUrl: "/reference.mp4", duration: 4, width: 1080, height: 1920 } },
    shots: { create: [1, 2].map((order) => ({ order, startTime: order - 1, endTime: order, targetDuration: 1, shotSize: "近景", cameraMovement: "固定", visualDescription: `参考 ${order}`, actionInstruction: `动作 ${order}`, cameraInstruction: "固定手机。", status: "READY" })) },
  }, include: { shots: { orderBy: { order: "asc" } } } });
  const brief = await db.shootingBrief.create({ data: { projectId: project.id, subject: "测试", talentMode: "SELF", location: "室内" } });
  const plan = await db.shootingPlan.create({ data: { projectId: project.id, briefId: brief.id, status: "READY" } });
  const plannedShots = await Promise.all(project.shots.map((reference, index) => db.plannedShot.create({ data: {
    shootingPlanId: plan.id,
    referenceShotId: reference.id,
    order: index + 1,
    purpose: `作用 ${index + 1}`,
    actionInstruction: `动作 ${index + 1}`,
    cameraInstruction: "固定手机。",
    targetDuration: 1,
    difficulty: "EASY",
  } })));
  return { project, plannedShots };
}

function storage(deleted: string[]): StorageProvider {
  return {
    async saveReferenceVideo() { throw new Error("unused"); },
    async saveReferenceFrame() { throw new Error("unused"); },
    async saveReferenceClip() { throw new Error("unused"); },
    async saveTake(projectId, plannedShotId, takeId, extension, source) {
      let size = 0;
      for await (const chunk of source) size += Buffer.byteLength(chunk);
      const key = `projects/${projectId}/takes/${plannedShotId}/${takeId}.${extension}`;
      return { key, url: `/api/files/${key}`, size };
    },
    async getLocalFile() { return { path: "mock-video.mp4", size: 4 }; },
    async deleteFile(key) { deleted.push(key); },
  };
}

test("同一 PlannedShot 保留多个待评价 Take，上传不会提前覆盖 selectedTakeId；跳过不计为完成", async () => {
  const { project, plannedShots } = await createProject();
  const deleted: string[] = [];
  const dependencies = { storage: storage(deleted), probe: async () => ({ duration: 2.8, width: 1080, height: 1920, fps: 30, codec: "h264" }) };
  try {
    const first = await saveTakeUpload({ projectId: project.id, plannedShotId: plannedShots[0].id, fileName: "one.mp4", size: 4, mimeType: "video/mp4", source: Readable.from("one!") }, dependencies);
    const second = await saveTakeUpload({ projectId: project.id, plannedShotId: plannedShots[0].id, fileName: "two.mp4", size: 4, mimeType: "video/mp4", source: Readable.from("two!") }, dependencies);
    const captured = await db.plannedShot.findUniqueOrThrow({ where: { id: plannedShots[0].id }, include: { takes: { orderBy: { createdAt: "asc" }, include: { evaluation: true } } } });
    assert.equal(captured.takes.length, 2);
    assert.equal(captured.takes[0].id, first.take.id);
    assert.equal(captured.takes[1].id, second.take.id);
    assert.equal(captured.selectedTakeId, null);
    assert.ok(captured.takes.every((take) => take.acceptanceStatus === "NOT_ACCEPTED" && take.evaluation?.status === "PENDING"));
    assert.equal(captured.captureStatus, "CAPTURED");
    assert.equal((await db.project.findUniqueOrThrow({ where: { id: project.id } })).status, "SHOOTING");

    const skipped = await skipPlannedShot(project.id, plannedShots[1].id);
    assert.deepEqual(skipped.progress, { total: 2, captured: 1, skipped: 1, notStarted: 0 });
    assert.equal(deleted.length, 0);
  } finally {
    await db.project.delete({ where: { id: project.id } });
  }
});

test("ffprobe 判定非法时不创建 Take 并删除已上传文件", async () => {
  const { project, plannedShots } = await createProject();
  const deleted: string[] = [];
  try {
    await assert.rejects(saveTakeUpload({ projectId: project.id, plannedShotId: plannedShots[0].id, fileName: "bad.mp4", size: 4, mimeType: "video/mp4", source: Readable.from("bad!") }, {
      storage: storage(deleted),
      probe: async () => { throw new Error("invalid video"); },
    }), /invalid video/);
    assert.equal(await db.take.count({ where: { plannedShotId: plannedShots[0].id } }), 0);
    assert.equal(deleted.length, 1);
  } finally {
    await db.project.delete({ where: { id: project.id } });
  }
});
