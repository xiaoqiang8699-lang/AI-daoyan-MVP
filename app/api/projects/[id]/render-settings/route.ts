import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { publicError, WorkflowError } from "@/lib/errors";
import { requireSameOrigin } from "@/lib/request-security";

async function settings(projectId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, userId: DEMO_USER_ID }, select: { id: true } });
  if (!project) throw new WorkflowError("PROJECT_NOT_FOUND", "项目不存在。", 404);
  const [current, tracks] = await Promise.all([db.videoRenderSettings.upsert({ where: { projectId }, create: { projectId }, update: {} }), db.bgmTrack.findMany({ where: { active: true }, select: { id: true, name: true, category: true, licenseNote: true }, orderBy: { name: "asc" } })]);
  return { settings: current, tracks };
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { return Response.json(await settings((await params).id)); } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error }, { status: failure.status }); } }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { requireSameOrigin(request); const projectId = (await params).id; await settings(projectId); const body = await request.json() as { subtitleEnabled?: unknown; bgmEnabled?: unknown; bgmTrackId?: unknown; bgmVolume?: unknown }; const bgmVolume = Number(body.bgmVolume); const updated = await db.videoRenderSettings.update({ where: { projectId }, data: { subtitleEnabled: typeof body.subtitleEnabled === "boolean" ? body.subtitleEnabled : true, bgmEnabled: body.bgmEnabled === true, bgmTrackId: typeof body.bgmTrackId === "string" ? body.bgmTrackId : null, bgmVolume: Number.isFinite(bgmVolume) ? Math.min(0.18, Math.max(0.1, bgmVolume)) : 0.14, version: { increment: 1 } } }); return Response.json(updated); } catch (error) { const failure = publicError(error); return Response.json({ error: failure.error }, { status: failure.status }); } }
