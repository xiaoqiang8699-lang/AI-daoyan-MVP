import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { WorkflowError, publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { enqueueMaterialAnalysis, getMaterialAnalysisQueue } from "@/lib/material-queue";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { requireSameOrigin(request); const id = (await params).id; const batch = await db.materialBatch.findFirst({ where: { id, userId: DEMO_USER_ID }, select: { id: true, status: true, _count: { select: { assets: true } } } }); if (!batch) throw new WorkflowError("MATERIAL_BATCH_NOT_FOUND", "找不到这组素材。", 404); if (!batch._count.assets) throw new WorkflowError("NO_MATERIALS", "请先添加至少一条素材。", 422); if (batch.status === "ANALYZING") { const job = await getMaterialAnalysisQueue().getJob(id); if (!job || await job.getState() !== "failed") return Response.json({ status: batch.status }, { status: 202 }); } await db.materialBatch.update({ where: { id }, data: { status: "ANALYZING", errorMessage: null } }); await enqueueMaterialAnalysis(id); return Response.json({ status: "ANALYZING" }, { status: 202 }); }
  catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); }
}
