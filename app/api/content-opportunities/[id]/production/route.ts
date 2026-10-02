import { publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { startOpportunityProduction } from "@/lib/production";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); return Response.json(await startOpportunityProduction((await params).id), { status: 201 }); }
  catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); }
}
