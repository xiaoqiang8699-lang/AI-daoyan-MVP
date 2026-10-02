import { z } from "zod";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";

const input = z.object({ plan: z.enum(["CREATOR", "PRO", "NONE"]) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); const projectId = (await params).id; const session = await db.userTestSession.findFirst({ where: { projectId, userId: DEMO_USER_ID } }); if (!session) return Response.json({ error: "当前项目不在测试模式。" }, { status: 409 }); const { plan } = input.parse(await request.json()); await db.userTestSession.update({ where: { id: session.id }, data: { selectedPlan: plan } }); await recordProductEvent({ eventName: AnalyticsEvent.PRICING_PLAN_SELECTED, projectId, sessionId: session.id, eventData: { plan } }); return Response.json({ selectedPlan: plan }); }
  catch (error) { const failure = publicError(error); return Response.json({ error: failure.error }, { status: failure.status || 400 }); }
}
