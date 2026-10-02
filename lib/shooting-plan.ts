import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { DEMO_USER_ID } from "./demo-user";
import { WorkflowError, publicError } from "./errors";
import { logEvent } from "./logger";
import { getVideoAIProvider } from "../packages/ai/get-video-ai-provider";
import { getVideoAIConfig } from "../packages/ai/config";
import { validatePlannedShots } from "../packages/ai/planned-shot-schema";
import type { GenerateShootingPlanInput, PlannedShotPlan } from "../packages/ai/types";
import type { VideoAIProvider } from "../packages/ai/video-ai-provider";
import { recordProductEvent, recordUsage } from "./analytics";
import { AnalyticsEvent } from "./analytics-events";

export const DEFAULT_PLAN_GOAL = "保留参考视频的节奏和拍法，把内容改成适合我的版本。";

export const shootingBriefInputSchema = z.object({
  subject: z.string().trim().min(1, "请告诉 AI 你要拍什么。").max(1000),
  talentMode: z.enum(["SELF", "OTHER_PERSON", "PRODUCT_ONLY"]),
  location: z.string().trim().max(300).default(""),
  additionalContext: z.string().trim().max(1000).nullable().optional(),
}).strict();

export type ShootingBriefForm = z.infer<typeof shootingBriefInputSchema>;

function parseBrief(value: unknown) {
  const result = shootingBriefInputSchema.safeParse(value);
  if (!result.success) throw new WorkflowError("INVALID_BRIEF", result.error.issues[0]?.message || "拍摄需求填写不完整。", 400, { cause: result.error });
  return result.data;
}

async function ownedProject(projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId: DEMO_USER_ID },
    include: {
      referenceVideo: true,
      shootingBrief: true,
      shootingPlan: { include: { shots: { orderBy: { order: "asc" }, include: {
        takes: { orderBy: { createdAt: "desc" }, include: { evaluation: true } },
        selectedTake: { include: { evaluation: true } },
      } } } },
      shots: { orderBy: { order: "asc" } },
    },
  });
  if (!project) throw new WorkflowError("NOT_FOUND", "没有找到这个项目。", 404);
  return project;
}

export async function saveShootingBrief(projectId: string, value: unknown) {
  const brief = parseBrief(value);
  const project = await ownedProject(projectId);
  if (!project.shots.length || !project.referenceVideo) throw new WorkflowError("REFERENCE_NOT_READY", "请先完成参考视频分析。", 409);
  await recordProductEvent({ eventName: AnalyticsEvent.SHOOTING_BRIEF_STARTED, projectId });
  const saved = await db.shootingBrief.upsert({
    where: { projectId },
    create: { projectId, ...brief, additionalContext: brief.additionalContext || null, goal: DEFAULT_PLAN_GOAL },
    update: { ...brief, additionalContext: brief.additionalContext || null },
  });
  await recordProductEvent({ eventName: AnalyticsEvent.SHOOTING_BRIEF_COMPLETED, projectId });
  return saved;
}

function providerInput(project: Awaited<ReturnType<typeof ownedProject>>, referenceShots = project.shots): GenerateShootingPlanInput {
  if (!project.shootingBrief || !project.referenceVideo) throw new WorkflowError("BRIEF_MISSING", "请先填写拍摄需求。", 409);
  return {
    project: { id: project.id, name: project.name },
    brief: {
      subject: project.shootingBrief.subject,
      talentMode: project.shootingBrief.talentMode,
      location: project.shootingBrief.location,
      goal: project.shootingBrief.goal,
      additionalContext: project.shootingBrief.additionalContext,
    },
    referenceVideo: {
      duration: project.referenceVideo.duration,
      width: project.referenceVideo.width,
      height: project.referenceVideo.height,
      fps: project.referenceVideo.fps,
      codec: project.referenceVideo.codec,
    },
    referenceShots: referenceShots.map((shot) => ({
      id: shot.id,
      order: shot.order,
      startTime: shot.startTime,
      endTime: shot.endTime,
      targetDuration: shot.targetDuration,
      shotSize: shot.shotSize,
      cameraMovement: shot.cameraMovement,
      visualDescription: shot.visualDescription,
      dialogue: shot.dialogue,
    })),
  };
}

export async function generateProjectShootingPlan(projectId: string, dependencies: { provider?: VideoAIProvider } = {}) {
  const project = await ownedProject(projectId);
  if (!project.shootingBrief) throw new WorkflowError("BRIEF_MISSING", "请先填写拍摄需求。", 409);
  if (!project.shots.length) throw new WorkflowError("REFERENCE_NOT_READY", "请先完成参考视频分析。", 409);
  if (project.shootingPlan?.shots.some((shot) => shot.takes.length)) throw new WorkflowError("PLAN_HAS_TAKES", "已经开始拍摄，不能重新生成整套方案。", 409);
  const token = randomUUID();
  const previousReady = project.shootingPlan?.status === "READY" && project.shootingPlan.shots.length > 0;
  let planId: string;
  if (project.shootingPlan) {
    const claimed = await db.shootingPlan.updateMany({
      where: { id: project.shootingPlan.id, generationToken: null },
      data: { generationToken: token, generationError: null, briefId: project.shootingBrief.id, ...(previousReady ? {} : { status: "GENERATING" }) },
    });
    if (!claimed.count) throw new WorkflowError("PLAN_BUSY", "拍摄方案正在生成，请稍候。", 409);
    planId = project.shootingPlan.id;
  } else {
    const plan = await db.shootingPlan.create({ data: { projectId, briefId: project.shootingBrief.id, status: "GENERATING", generationToken: token } });
    planId = plan.id;
  }

  const config = dependencies.provider ? { provider: "test", model: null } : getVideoAIConfig();
  const started = Date.now();
  await recordProductEvent({ eventName: AnalyticsEvent.SHOOTING_PLAN_STARTED, projectId });
  logEvent("shooting_plan.start", { projectId, planId, ...config, referenceShotCount: project.shots.length });
  try {
    const input = providerInput(project);
    const generated = validatePlannedShots(await (dependencies.provider || getVideoAIProvider()).generateShootingPlan(input), input.referenceShots, { talentMode: input.brief.talentMode });
    await db.$transaction(async (tx) => {
      const locked = await tx.shootingPlan.updateMany({ where: { id: planId, generationToken: token }, data: { updatedAt: new Date() } });
      if (!locked.count) throw new WorkflowError("PLAN_EXPIRED", "本次方案生成已中断，请重新生成。", 409);
      await tx.plannedShot.deleteMany({ where: { shootingPlanId: planId } });
      await tx.plannedShot.createMany({ data: generated.map((shot) => ({ ...shot, shootingPlanId: planId })) });
      await tx.shootingPlan.update({ where: { id: planId }, data: { status: "READY", generationToken: null, generationError: null } });
    });
    logEvent("shooting_plan.success", { projectId, planId, ...config, shotCount: generated.length, durationMs: Date.now() - started });
    await recordProductEvent({ eventName: AnalyticsEvent.SHOOTING_PLAN_COMPLETED, projectId, eventData: { shotCount: generated.length } });
    await recordUsage({ projectId, operation: "SHOOTING_PLAN_GENERATION", provider: config.provider, model: config.model, durationMs: Date.now() - started });
    return { planId, status: "READY" as const, shotCount: generated.length };
  } catch (error) {
    const failure = publicError(error);
    await db.shootingPlan.updateMany({ where: { id: planId, generationToken: token }, data: { status: previousReady ? "READY" : "FAILED", generationToken: null, generationError: failure.error } });
    logEvent("shooting_plan.fail", { projectId, planId, ...config, durationMs: Date.now() - started, error });
    await recordProductEvent({ eventName: AnalyticsEvent.SHOOTING_PLAN_FAILED, projectId });
    throw error;
  }
}

export async function regenerateProjectPlannedShot(projectId: string, plannedShotId: string, reasonValue: unknown, dependencies: { provider?: VideoAIProvider } = {}) {
  const parsedReason = z.string().trim().max(500).nullable().safeParse(reasonValue ?? null);
  if (!parsedReason.success) throw new WorkflowError("INVALID_REASON", "补充要求最多填写 500 个字。", 400, { cause: parsedReason.error });
  const reason = parsedReason.data;
  const project = await ownedProject(projectId);
  const plan = project.shootingPlan;
  if (!plan || plan.status !== "READY") throw new WorkflowError("PLAN_NOT_READY", "拍摄方案尚未准备好。", 409);
  const current = plan.shots.find((shot) => shot.id === plannedShotId);
  if (!current) throw new WorkflowError("SHOT_NOT_FOUND", "没有找到这个计划镜头。", 404);
  const reference = project.shots.find((shot) => shot.id === current.referenceShotId);
  if (!reference) throw new WorkflowError("REFERENCE_SHOT_MISSING", "对应的参考镜头不存在。", 409);
  const input = providerInput(project, [reference]);
  const currentShot: PlannedShotPlan = {
    referenceShotId: current.referenceShotId,
    order: current.order,
    purpose: current.purpose,
    actionInstruction: current.actionInstruction,
    cameraInstruction: current.cameraInstruction,
    dialogue: current.dialogue,
    targetDuration: current.targetDuration,
    difficulty: current.difficulty,
    notes: current.notes,
  };
  const config = dependencies.provider ? { provider: "test", model: null } : getVideoAIConfig();
  const started = Date.now();
  logEvent("planned_shot.regenerate_start", { projectId, planId: plan.id, plannedShotId, referenceShotId: reference.id, ...config });
  try {
    const generated = validatePlannedShots([
      await (dependencies.provider || getVideoAIProvider()).regeneratePlannedShot({ ...input, currentShot, reason }),
    ], input.referenceShots, { talentMode: input.brief.talentMode })[0];
    const updated = await db.plannedShot.update({ where: { id: plannedShotId }, data: {
      purpose: generated.purpose,
      actionInstruction: generated.actionInstruction,
      cameraInstruction: generated.cameraInstruction,
      dialogue: generated.dialogue,
      targetDuration: generated.targetDuration,
      difficulty: generated.difficulty,
      notes: generated.notes,
    } });
    logEvent("planned_shot.regenerate_success", { projectId, planId: plan.id, plannedShotId, ...config, durationMs: Date.now() - started });
    await recordProductEvent({ eventName: AnalyticsEvent.PLANNED_SHOT_REGENERATED, projectId, eventData: { reasonCategory: "OTHER" } });
    return updated;
  } catch (error) {
    logEvent("planned_shot.regenerate_fail", { projectId, planId: plan.id, plannedShotId, ...config, durationMs: Date.now() - started, error });
    throw error;
  }
}

export async function getProjectWithShootingPlan(projectId: string) {
  return ownedProject(projectId);
}
