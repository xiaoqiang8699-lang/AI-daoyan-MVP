import { publicError } from "@/lib/errors";
import { getFinalVideoView, reserveFinalRender } from "@/lib/final-video";
import { requireSameOrigin } from "@/lib/request-security";
import { enqueueFinalRender } from "@/lib/render-queue";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getFinalVideoView((await params).id)); }
  catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    requireSameOrigin(request);
    const reservation = await reserveFinalRender(id);
    if (!reservation.busy) await recordProductEvent({ eventName: AnalyticsEvent.FINAL_RENDER_STARTED, projectId: id });
    if (!reservation.busy) await enqueueFinalRender({ projectId: id, finalVideoId: reservation.finalVideoId, renderToken: reservation.renderToken });
    return Response.json(reservation, { status: 202 });
  } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); }
}
