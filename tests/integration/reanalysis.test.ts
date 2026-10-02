import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { analyzeProject } from "../../lib/analysis";
import { db } from "../../lib/db";
import { ensureDemoUser, DEMO_USER_ID } from "../../lib/demo-user";
import type { StorageProvider, StoredFile } from "../../lib/storage/storage-provider";
import type { VideoAIProvider } from "../../packages/ai/video-ai-provider";
import type { ShotPlan } from "../../packages/ai/types";

const makeShot = (order: number, startTime: number, endTime: number): ShotPlan => ({ order, startTime, endTime, targetDuration: endTime - startTime, shotSize: "近景", cameraMovement: "固定", visualDescription: `画面 ${order}`, actionInstruction: `动作 ${order}`, cameraInstruction: `机位 ${order}`, dialogue: null });

test("重新分析替换镜头；帧处理失败保留旧镜头且记录失败", async () => {
  await ensureDemoUser();
  const project = await db.project.create({ data: { userId: DEMO_USER_ID, name: `integration-${randomUUID()}`, status: "ANALYSIS_FAILED", referenceVideo: { create: { fileUrl: "/api/files/test", storageKey: "projects/test/reference/reference.mp4", mimeType: "video/mp4", duration: 4 } }, shots: { create: { ...makeShot(1, 0, 4), referenceFrameUrl: "/mock/shot-1.svg", status: "READY" } } } });
  const files = new Set<string>();
  const storage: StorageProvider = {
    async saveReferenceVideo() { throw new Error("unused"); },
    async saveReferenceFrame(id, shotId, jpeg): Promise<StoredFile> { const key = `projects/${id}/shots/${shotId}/reference.jpg`; files.add(key); return { key, url: `/api/files/${key}`, size: jpeg.length }; },
    async saveReferenceClip() { throw new Error("unused"); },
    async saveTake() { throw new Error("unused"); },
    async getLocalFile() { return { path: "not-read-by-test", size: 1 }; },
    async deleteFile(key) { files.delete(key); },
  };
  const provider = (plans: ShotPlan[]): VideoAIProvider => ({ async analyzeReferenceVideo() { return plans; }, async generateShootingPlan() { throw new Error("unused"); }, async regeneratePlannedShot() { throw new Error("unused"); }, async evaluateTake() { throw new Error("unused"); } });
  try {
    const failed = await analyzeProject(project.id, true, { provider: provider([makeShot(1, 0, 2), makeShot(2, 2, 4)]), storage, extractFrame: async (_path, time) => { if (time > 2) throw new Error("frame failure"); return Buffer.from([0xff, 0xd8, 0xff]); } });
    assert.equal(failed.status, "ANALYSIS_FAILED");
    assert.equal(failed.shotCount, 1);
    assert.equal(files.size, 0);
    const success = await analyzeProject(project.id, true, { provider: provider([makeShot(1, 0, 2), makeShot(2, 2, 4)]), storage, extractFrame: async () => Buffer.from([0xff, 0xd8, 0xff]) });
    assert.equal(success.status, "READY_TO_SHOOT");
    assert.equal(success.shotCount, 2);
    const again = await analyzeProject(project.id, true, { provider: provider([makeShot(1, 0, 4)]), storage, extractFrame: async () => Buffer.from([0xff, 0xd8, 0xff]) });
    assert.equal(again.status, "READY_TO_SHOOT");
    assert.equal(again.shotCount, 1);
  } finally {
    await db.project.delete({ where: { id: project.id } });
  }
});
