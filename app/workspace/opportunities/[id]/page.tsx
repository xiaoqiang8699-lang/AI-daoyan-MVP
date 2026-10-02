import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLatestMaterialBatch } from "@/lib/materials";
import { StartProductionButton } from "@/components/start-production-button";

export default async function OpportunityDetail({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id; const batch = await getLatestMaterialBatch(); const item = batch?.opportunities.find((candidate) => candidate.id === id); if (!item) notFound();
  const canProduce = item.status !== "OUTDATED";
  return <div className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-10"><Button asChild variant="ghost" size="sm"><Link href="/workspace/opportunities"><ArrowLeft />内容机会</Link></Button><h1 className="mt-6 text-2xl font-bold">{item.title}</h1><p className="mt-3 text-muted-foreground">{item.angle}</p><Card className="mt-6"><CardContent><h2 className="font-semibold">建议结构</h2><ol className="mt-4 space-y-3">{item.segments.map((segment) => <li key={segment.id} className="rounded-lg bg-workspace-soft p-3 text-sm"><strong>{segment.role}</strong> · {segment.description}</li>)}</ol></CardContent></Card>{item.missingMaterials.length ? <Card className="mt-4"><CardContent><h2 className="font-semibold">补拍任务</h2>{item.missingMaterials.map((missing) => <p key={missing.id} className="mt-3 text-sm leading-6 text-muted-foreground">{missing.actionInstruction} {missing.cameraInstruction}</p>)}</CardContent></Card> : null}<div className="mt-6">{canProduce ? <StartProductionButton opportunityId={item.id} label={item.status === "READY" ? "开始制作" : "补齐素材并制作"} /> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">素材发生变化，请先重新整理内容机会。</p>}</div><p className="mt-5 text-sm text-muted-foreground">制作方案会引用已有素材；当前不会自动生成完整视频。</p></div>;
}
