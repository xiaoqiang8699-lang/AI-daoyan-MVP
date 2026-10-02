import { z } from "zod";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";
import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
const input = z.object({ eventName: z.enum([AnalyticsEvent.FINAL_VIDEO_VIEWED, AnalyticsEvent.FINAL_VIDEO_DOWNLOADED, AnalyticsEvent.PRICING_PAGE_VIEWED, AnalyticsEvent.SHOT_PREPARED, AnalyticsEvent.SHOT_RECORDING_STARTED, AnalyticsEvent.SHOT_RECORDING_COMPLETED, AnalyticsEvent.HELP_FEEDBACK_OPENED]) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { requireSameOrigin(request); const body = input.parse(await request.json()); await recordProductEvent({ eventName: body.eventName, projectId: (await params).id }); return new Response(null, { status: 204 }); } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error }, { status: failure.status || 400 }); } }
