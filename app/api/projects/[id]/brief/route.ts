import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { saveShootingBrief } from "@/lib/shooting-plan";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const brief = await saveShootingBrief((await params).id, await request.json());
    return Response.json({ id: brief.id });
  } catch (error) {
    const failure = publicError(error);
    return Response.json({ error: failure.error, code: failure.code }, { status: failure.status });
  }
}
