import { z } from "zod";
import { db } from "@/lib/db";
import { DEMO_USER_ID, ensureDemoUser } from "@/lib/demo-user";
import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";

const input = z.object({ businessDate: z.string().datetime().optional(), goal: z.enum(["EXPLORE", "PRODUCT", "PERSONAL_IP", "DAILY_VLOG"]).optional() });
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const body = input.parse(await request.json()); await ensureDemoUser();
    const batch = await db.materialBatch.create({ data: { userId: DEMO_USER_ID, businessDate: body.businessDate ? new Date(body.businessDate) : new Date(), goal: body.goal || "EXPLORE" } });
    await recordProductEvent({ eventName: AnalyticsEvent.MATERIAL_BATCH_CREATED });
    return Response.json({ id: batch.id }, { status: 201 });
  } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); }
}
