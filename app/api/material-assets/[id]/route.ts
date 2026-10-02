import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { WorkflowError, publicError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";
import { getStorageProvider } from "@/lib/storage";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request); const id = (await params).id;
    const asset = await db.materialAsset.findFirst({ where: { id, batch: { userId: DEMO_USER_ID } }, select: { id: true, storageKey: true, thumbnailStorageKey: true } });
    if (!asset) throw new WorkflowError("MATERIAL_NOT_FOUND", "找不到这条素材。", 404);
    const affected = await db.contentOpportunity.findMany({ where: { segments: { some: { materialAssetId: id } } }, select: { id: true } });
    await db.$transaction([db.contentOpportunity.updateMany({ where: { id: { in: affected.map((item) => item.id) } }, data: { status: "OUTDATED" } }), db.productionPlan.updateMany({ where: { opportunityId: { in: affected.map((item) => item.id) } }, data: { status: "OUTDATED" } }), db.materialAsset.delete({ where: { id } })]);
    await Promise.all([getStorageProvider().deleteFile(asset.storageKey), asset.thumbnailStorageKey ? getStorageProvider().deleteFile(asset.thumbnailStorageKey) : Promise.resolve()]);
    return new Response(null, { status: 204 });
  } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error, code: failure.code }, { status: failure.status }); }
}
