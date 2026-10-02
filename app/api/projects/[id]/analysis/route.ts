import { analyzeProject, getAnalysisState } from "@/lib/analysis";
import { publicError } from "@/lib/errors";
import { logEvent } from "@/lib/logger";
import { requireSameOrigin } from "@/lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getAnalysisState((await params).id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { const failure = publicError(error); return Response.json({ error: failure.error }, { status: failure.status }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    requireSameOrigin(request);
    const retry = new URL(request.url).searchParams.get("retry") === "true";
    const state = await analyzeProject(id, retry);
    return Response.json(state, { status: state.status === "ANALYZING" ? 202 : 200 });
  } catch (error) {
    logEvent("analysis.request_failed", { projectId: id, error });
    const failure = publicError(error);
    return Response.json({ error: failure.error }, { status: failure.status });
  }
}
