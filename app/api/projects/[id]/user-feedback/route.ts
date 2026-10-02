import { z } from "zod";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
const input = z.object({ stage: z.enum(["REFERENCE", "BRIEF", "PLAN", "SHOOT", "EVALUATION", "RENDER", "RESULT", "PRICING"]), category: z.enum(["CONFUSING", "AI_INCORRECT", "ERROR", "SLOW", "OTHER"]), message: z.string().trim().max(1000).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { requireSameOrigin(request); const value = input.parse(await request.json()); const projectId = (await params).id; const feedback = await db.userFeedback.create({ data: { userId: DEMO_USER_ID, projectId, ...value, message: value.message || null } }); return Response.json(feedback, { status: 201 }); } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error }, { status: failure.status || 400 }); } }
