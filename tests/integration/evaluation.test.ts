import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { test } from "node:test";
import { db } from "../../lib/db";
import { ensureDemoUser, DEMO_USER_ID } from "../../lib/demo-user";
import { acceptTakeDespiteEvaluation, evaluateSavedTake } from "../../lib/take-evaluation";
import { saveTakeUpload } from "../../lib/takes";
import type { StorageProvider } from "../../lib/storage/storage-provider";
import type { TakeEvaluation } from "../../packages/ai/types";
import type { VideoAIProvider } from "../../packages/ai/video-ai-provider";

async function createProject() {
  await ensureDemoUser();
  const project = await db.project.create({ data: {
    userId: DEMO_USER_ID,
    name: `evaluation-${randomUUID()}`,
    status: "READY_TO_SHOOT",
    referenceVideo: { create: { fileUrl: "/api/files/projects/test/reference/reference.mp4", duration: 4, width: 1080, height: 1920, mimeType: "video/mp4" } },
    shots: { create: { order: 1, startTime: 0, endTime: 2, targetDuration: 2, shotSize: "中景", cameraMovement: "固定", visualDescription: "人物完整转身", actionInstruction: "转身", cameraInstruction: "固定手机", status: "READY" } },
  }, include: { shots: true } });
  const brief = await db.shootingBrief.create({ data: { projectId: project.id, subject: "测试", talentMode: "SELF", location: "室内" } });
  const plan = await db.shootingPlan.create({ data: { projectId: project.id, briefId: brief.id, status: "READY" } });
  const plannedShot = await db.plannedShot.create({ data: { shootingPlanId: plan.id, referenceShotId: project.shots[0].id, order: 1, purpose: "展示侧身", actionInstruction: "完整转身", cameraInstruction: "固定手机", targetDuration: 2, difficulty: "EASY" } });
  return { project, plannedShot };
}

function storage(): StorageProvider {
  let clipSaved = false;
  return {
    async saveReferenceVideo() { throw new Error("unused"); },
    async saveReferenceFrame() { throw new Error("unused"); },
    async saveReferenceClip(projectId, shotId, mp4) { clipSaved = true; const key = `projects/${projectId}/shots/${shotId}/reference-clip.mp4`; return { key, url: `/api/files/${key}`, size: mp4.length }; },
    async saveTake(projectId, plannedShotId, takeId, extension, source) {
      let size = 0;
      for await (const chunk of source) size += Buffer.byteLength(chunk);
      const key = `projects/${projectId}/takes/${plannedShotId}/${takeId}.${extension}`;
      return { key, url: `/api/files/${key}`, size };
    },
    async getLocalFile(key) {
      if (key.endsWith("reference-clip.mp4") && !clipSaved) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return { path: "mock-video.mp4", size: 4 };
    },
    async deleteFile() {},
  };
}

function evaluation(passed: boolean): TakeEvaluation {
  return passed ? {
    passed: true, overallScore: 88, dimensions: { framing: 85, action: 90, movement: 80, timing: 86, visibility: 92 }, criticalIssues: [], mainIssue: null, advice: "这条可以使用。", confidence: 0.9, evidence: "动作完成。", issueStartTime: null, issueEndTime: null,
  } : {
    passed: false, overallScore: 55, dimensions: { framing: 82, action: 40, movement: 80, timing: 55, visibility: 90 }, criticalIssues: ["KEY_ACTION_MISSING"], mainIssue: "核心转身动作没有完成。", advice: "完整转到侧身后停半秒。", confidence: 0.92, evidence: "人物没有转身。", issueStartTime: 0, issueEndTime: 2,
  };
}

function provider(result: TakeEvaluation, wait = 0, calls?: { value: number }): VideoAIProvider {
  return {
    async analyzeReferenceVideo() { throw new Error("unused"); },
    async generateShootingPlan() { throw new Error("unused"); },
    async regeneratePlannedShot() { throw new Error("unused"); },
    async evaluateTake() { if (calls) calls.value += 1; if (wait) await new Promise((resolve) => setTimeout(resolve, wait)); return result; },
  };
}

const probe = async () => ({ duration: 2, width: 1080, height: 1920, fps: 30, codec: "h264" });
const extractClip = async () => Buffer.from("reference-clip");

async function upload(projectId: string, plannedShotId: string, store: StorageProvider) {
  return saveTakeUpload({ projectId, plannedShotId, fileName: "take.mp4", size: 4, mimeType: "video/mp4", source: Readable.from("take") }, { storage: store, probe });
}

test("旧 Take 已通过时，新 Take 未通过不会覆盖 selectedTakeId；用户仍可强制采用", async () => {
  const { project, plannedShot } = await createProject();
  const store = storage();
  try {
    const first = await upload(project.id, plannedShot.id, store);
    await evaluateSavedTake(project.id, first.take.id, false, { storage: store, probe, extractClip, provider: provider(evaluation(true)) });
    assert.equal((await db.plannedShot.findUniqueOrThrow({ where: { id: plannedShot.id } })).selectedTakeId, first.take.id);

    const second = await upload(project.id, plannedShot.id, store);
    await evaluateSavedTake(project.id, second.take.id, false, { storage: store, probe, extractClip, provider: provider(evaluation(false)) });
    assert.equal((await db.plannedShot.findUniqueOrThrow({ where: { id: plannedShot.id } })).selectedTakeId, first.take.id);
    assert.equal((await db.take.findUniqueOrThrow({ where: { id: second.take.id } })).acceptanceStatus, "NOT_ACCEPTED");

    await acceptTakeDespiteEvaluation(project.id, second.take.id);
    assert.equal((await db.plannedShot.findUniqueOrThrow({ where: { id: plannedShot.id } })).selectedTakeId, second.take.id);
    assert.equal((await db.take.findUniqueOrThrow({ where: { id: second.take.id } })).acceptanceStatus, "USER_ACCEPTED");
  } finally { await db.project.delete({ where: { id: project.id } }); }
});

test("同一 Take 的并发检查只调用一次 Provider", async () => {
  const { project, plannedShot } = await createProject();
  const store = storage();
  const calls = { value: 0 };
  try {
    const take = await upload(project.id, plannedShot.id, store);
    await Promise.all([
      evaluateSavedTake(project.id, take.take.id, true, { storage: store, probe, extractClip, provider: provider(evaluation(true), 100, calls) }),
      evaluateSavedTake(project.id, take.take.id, true, { storage: store, probe, extractClip, provider: provider(evaluation(true), 100, calls) }),
    ]);
    assert.equal(calls.value, 1);
    assert.equal((await db.evaluation.findUniqueOrThrow({ where: { takeId: take.take.id } })).status, "PASSED");
  } finally { await db.project.delete({ where: { id: project.id } }); }
});

test("AI 失败保留 Take 并记录 FAILED，允许稍后重新检查", async () => {
  const { project, plannedShot } = await createProject();
  const store = storage();
  const failing: VideoAIProvider = { ...provider(evaluation(true)), async evaluateTake() { throw new Error("provider timeout"); } };
  try {
    const take = await upload(project.id, plannedShot.id, store);
    await assert.rejects(evaluateSavedTake(project.id, take.take.id, false, { storage: store, probe, extractClip, provider: failing }), /provider timeout/);
    assert.ok(await db.take.findUnique({ where: { id: take.take.id } }));
    assert.equal((await db.evaluation.findUniqueOrThrow({ where: { takeId: take.take.id } })).status, "FAILED");
  } finally { await db.project.delete({ where: { id: project.id } }); }
});
