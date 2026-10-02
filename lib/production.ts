import "server-only";
import { db } from "./db";
import { DEMO_USER_ID } from "./demo-user";
import { WorkflowError } from "./errors";
import { AnalyticsEvent } from "./analytics-events";
import { recordProductEvent } from "./analytics";

const productionInclude = { opportunity: { include: { segments: { orderBy: { order: "asc" }, include: { materialAsset: { include: { analysis: true } } } }, missingMaterials: { orderBy: { order: "asc" } } } }, captureTasks: { orderBy: { order: "asc" }, include: { selectedTake: { include: { evaluation: true } }, takes: { include: { evaluation: true }, orderBy: { createdAt: "desc" } } } } } as const;

export async function getProductionPlan(id: string) {
  const plan = await db.productionPlan.findFirst({ where: { id, opportunity: { batch: { userId: DEMO_USER_ID } } }, include: productionInclude });
  if (!plan) throw new WorkflowError("PRODUCTION_NOT_FOUND", "找不到这份制作方案。", 404);
  return plan;
}

export async function startOpportunityProduction(opportunityId: string) {
  const opportunity = await db.contentOpportunity.findFirst({ where: { id: opportunityId, batch: { userId: DEMO_USER_ID } }, include: { missingMaterials: { orderBy: { order: "asc" } } } });
  if (!opportunity) throw new WorkflowError("OPPORTUNITY_NOT_FOUND", "找不到这个内容机会。", 404);
  if (opportunity.status === "OUTDATED") throw new WorkflowError("OPPORTUNITY_OUTDATED", "素材发生变化，请先重新整理内容机会。", 409);
  const existing = await db.productionPlan.findUnique({ where: { opportunityId }, include: productionInclude });
  if (existing) return existing;
  const plan = await db.productionPlan.create({ data: {
    opportunityId,
    title: opportunity.title,
    angle: opportunity.angle,
    hook: opportunity.hook,
    targetDuration: opportunity.targetDuration,
    captureTasks: { create: opportunity.missingMaterials.map((missing) => ({ sourceType: "OPPORTUNITY_MISSING_MATERIAL", sourceId: missing.id, order: missing.order, purpose: missing.purpose, actionInstruction: missing.actionInstruction, cameraInstruction: missing.cameraInstruction, targetDuration: missing.targetDuration })) },
  }, include: productionInclude });
  await db.contentOpportunity.update({ where: { id: opportunityId }, data: { status: "IN_PROGRESS" } });
  await recordProductEvent({ eventName: AnalyticsEvent.CONTENT_PRODUCTION_STARTED, eventData: { opportunityId, captureTaskCount: plan.captureTasks.length } });
  return plan;
}

export async function refreshProductionStatus(productionId: string) {
  const plan = await getProductionPlan(productionId);
  if (plan.status === "OUTDATED") return plan;
  const complete = plan.captureTasks.every((task) => task.selectedTakeId);
  if (complete && plan.status !== "MATERIALS_READY") {
    await db.productionPlan.update({ where: { id: productionId }, data: { status: "MATERIALS_READY" } });
    await recordProductEvent({ eventName: AnalyticsEvent.PRODUCTION_MATERIALS_READY, eventData: { productionId } });
    return getProductionPlan(productionId);
  }
  return plan;
}
