import { z } from "zod";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { WorkflowError, publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";

const input = z.object({ action: z.enum(["view", "select", "dismiss", "missing_view"]) });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const body = input.parse(await request.json()); const id = (await params).id;
    const opportunity = await db.contentOpportunity.findFirst({ where: { id, batch: { userId: DEMO_USER_ID } }, select: { id: true } }); if (!opportunity) throw new WorkflowError("OPPORTUNITY_NOT_FOUND", "找不到这个内容机会。", 404);
    if (body.action === "select") await db.contentOpportunity.update({ where: { id }, data: { status: "SELECTED" } });
    if (body.action === "dismiss") await db.contentOpportunity.update({ where: { id }, data: { status: "DISMISSED" } });
    const eventName = body.action === "select" ? AnalyticsEvent.CONTENT_OPPORTUNITY_SELECTED : body.action === "dismiss" ? AnalyticsEvent.CONTENT_OPPORTUNITY_DISMISSED : body.action === "missing_view" ? AnalyticsEvent.MISSING_MATERIAL_VIEWED : AnalyticsEvent.CONTENT_OPPORTUNITY_VIEWED;
    await recordProductEvent({ eventName }); return Response.json({ ok: true });
  } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); }
}
