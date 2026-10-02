import { publicError } from "@/lib/errors";
import { logEvent } from "@/lib/logger";
import { requireSameOrigin } from "@/lib/request-security";
import { generateProjectShootingPlan } from "@/lib/shooting-plan";

export const maxDuration = 900;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    requireSameOrigin(request);
    return Response.json(await generateProjectShootingPlan(id));
  } catch (error) {
    logEvent("shooting_plan.request_failed", { projectId: id, error });
    const failure = publicError(error);
    return Response.json({ error: failure.error, code: failure.code }, { status: failure.status });
  }
}
