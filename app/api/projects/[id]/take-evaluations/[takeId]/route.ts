import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { acceptTakeDespiteEvaluation, evaluateSavedTake } from "@/lib/take-evaluation";
import { recordProductEvent } from "@/lib/analytics";
import { AnalyticsEvent } from "@/lib/analytics-events";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string; takeId: string }> }) {
  const { id, takeId } = await params;
  try {
    requireSameOrigin(request);
    const body = await request.json().catch(() => ({})) as { retry?: unknown };
    await recordProductEvent({ eventName: AnalyticsEvent.TAKE_EVALUATION_STARTED, projectId: id });
    const result = await evaluateSavedTake(id, takeId, body.retry === true);
    if (!result.busy && result.evaluation) await recordProductEvent({ eventName: result.evaluation.status === "PASSED" ? AnalyticsEvent.TAKE_EVALUATION_PASSED : AnalyticsEvent.TAKE_EVALUATION_NEEDS_RETAKE, projectId: id });
    return Response.json(result, { status: result.busy ? 202 : 200 });
  } catch (error) {
    const failure = publicError(error);
    return Response.json({ error: failure.error, code: failure.code }, { status: failure.status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; takeId: string }> }) {
  const { id, takeId } = await params;
  try {
    requireSameOrigin(request);
    const body = await request.json().catch(() => null) as { action?: unknown } | null;
    if (body?.action !== "accept") return Response.json({ error: "无法识别这个操作。", code: "INVALID_ACTION" }, { status: 400 });
    const result = await acceptTakeDespiteEvaluation(id, takeId);
    await recordProductEvent({ eventName: AnalyticsEvent.TAKE_USER_ACCEPTED, projectId: id });
    return Response.json(result);
  } catch (error) {
    const failure = publicError(error);
    return Response.json({ error: failure.error, code: failure.code }, { status: failure.status });
  }
}
