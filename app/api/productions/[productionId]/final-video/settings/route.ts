import { publicError } from "@/lib/errors";
import { db } from "@/lib/db";
import { requireSameOrigin } from "@/lib/request-security";
export async function PATCH(request: Request, { params }: { params: Promise<{ productionId: string }> }) {
  try { requireSameOrigin(request); const productionPlanId = (await params).productionId; const body = await request.json() as { bgmEnabled?: boolean }; if (typeof body.bgmEnabled !== "boolean") return Response.json({ error: "背景音乐设置无效。" }, { status: 422 }); const settings = await db.videoRenderSettings.update({ where: { productionPlanId }, data: { bgmEnabled: body.bgmEnabled, version: { increment: 1 } } }); await db.finalVideo.updateMany({ where: { productionPlanId, status: "READY" }, data: { status: "OUTDATED" } }); return Response.json({ bgmEnabled: settings.bgmEnabled }); } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); }
}
