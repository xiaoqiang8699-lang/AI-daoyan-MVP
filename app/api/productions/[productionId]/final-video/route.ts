import { publicError } from "@/lib/errors";
import { getProductionFinalVideoView, reserveProductionFinalRender } from "@/lib/production-final-video";
import { requireSameOrigin } from "@/lib/request-security";
import { enqueueFinalRender } from "@/lib/render-queue";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ productionId: string }> }) { try { return Response.json(await getProductionFinalVideoView((await params).productionId)); } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); } }
export async function POST(request: Request, { params }: { params: Promise<{ productionId: string }> }) { const { productionId } = await params; try { requireSameOrigin(request); const reservation = await reserveProductionFinalRender(productionId); if (!reservation.busy) { await recordProductEvent({ eventName: AnalyticsEvent.CONTENT_RENDER_STARTED, eventData: { productionId } }); await enqueueFinalRender({ sourceType: "CONTENT_PRODUCTION", productionPlanId: productionId, finalVideoId: reservation.finalVideoId, renderToken: reservation.renderToken }); } return Response.json(reservation, { status: 202 }); } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); } }

