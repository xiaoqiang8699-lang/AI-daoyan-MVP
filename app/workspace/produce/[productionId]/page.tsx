import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getProductionPlan } from "@/lib/production";

export default async function ProductionPage({ params }: { params: Promise<{ productionId: string }> }) {
  let plan;
  try { plan = await getProductionPlan((await params).productionId); } catch { notFound(); }
  const captured = plan.captureTasks.filter((task) => task.selectedTakeId).length;
  return <main className="mx-auto max-w-4xl p-5 sm:p-8 lg:p-10"><Link className="text-sm text-muted-foreground" href={`/workspace/opportunities/${plan.opportunityId}`}>返回内容机会</Link><h1 className="mt-5 text-2xl font-bold">{plan.title}</h1><p className="mt-2 text-muted-foreground">{plan.angle}</p><section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-semibold">已有素材 {plan.opportunity.segments.length}</h2>{plan.opportunity.segments.map((segment) => <p key={segment.id} className="mt-2 text-sm text-muted-foreground">{segment.order}. {segment.description}</p>)}</section><section className="mt-4 rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">补拍进度</h2><span className="text-sm text-muted-foreground">{captured} / {plan.captureTasks.length}</span></div>{plan.captureTasks.map((task) => <div key={task.id} className="mt-4 rounded-xl bg-workspace-soft p-4"><p className="font-medium">{task.purpose}</p><p className="mt-1 text-sm text-muted-foreground">{task.actionInstruction}</p><Button asChild className="mt-3" size="sm"><Link href={`/workspace/produce/${plan.id}/shoot/${task.id}`}>{task.selectedTakeId ? "重新拍摄" : "开始补拍"}</Link></Button></div>)}</section>{plan.status === "MATERIALS_READY" && <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">素材已齐，可以生成视频。</p>}</main>;
}
