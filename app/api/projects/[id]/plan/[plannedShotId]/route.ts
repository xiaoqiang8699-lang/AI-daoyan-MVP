import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { regenerateProjectPlannedShot } from "@/lib/shooting-plan";

export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string; plannedShotId: string }> }) {
  try {
    requireSameOrigin(request);
    const { id, plannedShotId } = await params;
    const body = await request.json().catch(() => ({})) as { reason?: unknown };
    const shot = await regenerateProjectPlannedShot(id, plannedShotId, body.reason ?? null);
    return Response.json({ shot });
  } catch (error) {
    const failure = publicError(error);
    return Response.json({ error: failure.error, code: failure.code }, { status: failure.status });
  }
}
