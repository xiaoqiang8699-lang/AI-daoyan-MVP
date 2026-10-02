import { z } from "zod";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";

const feedback = z.object({ priorAbility: z.string().max(40), mostHelpful: z.string().max(40), mostDifficult: z.string().max(40), reuseIntent: z.string().max(40), publishIntent: z.string().max(40), dissatisfaction: z.string().trim().max(1000).optional(), recommendScore: z.number().int().min(0).max(10).nullable().optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); const projectId = (await params).id; const session = await db.userTestSession.findFirst({ where: { projectId, userId: DEMO_USER_ID } }); if (!session) return Response.json({ error: "当前项目不在测试模式。" }, { status: 409 }); const body = feedback.parse(await request.json()); const saved = await db.testFeedback.upsert({ where: { testSessionId: session.id }, create: { testSessionId: session.id, ...body, dissatisfaction: body.dissatisfaction || null, recommendScore: body.recommendScore ?? null }, update: { ...body, dissatisfaction: body.dissatisfaction || null, recommendScore: body.recommendScore ?? null } }); await recordProductEvent({ eventName: AnalyticsEvent.PROJECT_COMPLETED, projectId, sessionId: session.id }); return Response.json(saved); }
  catch (error) { const failure = publicError(error); return Response.json({ error: failure.error }, { status: failure.status || 400 }); }
}
