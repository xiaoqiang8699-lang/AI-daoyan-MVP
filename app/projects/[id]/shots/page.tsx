import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Eye, MessageCircle } from "lucide-react";
import { ProjectHeading } from "@/components/project-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProject } from "@/lib/projects";

export default async function ShotsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  const first = project.shots[0];
  return <div>
    <ProjectHeading name={project.name} title={first ? `参考视频包含 ${project.shots.length} 个镜头。` : "参考分析还在准备中"} description={first ? "这里记录原视频里实际发生的内容。生成个人方案后，AI 才会给出适合你的动作和手机拍法。" : "先完成分析，再来查看参考结构。"} />
    {first ? <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#eeeee5] p-5"><div><p className="text-sm font-medium">参考视频结构已准备好</p><p className="mt-1 text-xs text-muted-foreground">下一步，把这些镜头改成适合你的内容。</p></div><Button asChild><Link href={`/projects/${id}/${project.shootingPlan?.status === "READY" ? "plan" : "brief"}`}>{project.shootingPlan?.status === "READY" ? "查看我的方案" : "生成我的方案"}<ArrowRight /></Link></Button></div>
      <div className="grid gap-6 sm:grid-cols-2">{project.shots.map((shot) => <Card key={shot.id}><div className="relative"><Image src={shot.referenceFrameUrl || "/mock/reference.svg"} alt={`参考镜头 ${shot.order}`} width={640} height={400} className="aspect-[16/10] w-full object-cover" /><span className="absolute top-4 left-4 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium">镜头 {String(shot.order).padStart(2, "0")}</span><span className="absolute right-4 bottom-4 rounded-lg bg-white/90 px-2 py-1 text-xs">{shot.targetDuration} 秒</span></div><CardContent><dl className="space-y-4"><div className="flex gap-3"><Eye className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="mb-1 text-xs text-muted-foreground">参考画面</dt><dd className="text-sm leading-6">{shot.visualDescription}</dd></div></div><div className="text-xs text-muted-foreground">{shot.shotSize} · {shot.cameraMovement}</div>{shot.dialogue && <div className="flex gap-3"><MessageCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="mb-1 text-xs text-muted-foreground">原台词</dt><dd className="text-sm leading-6">{shot.dialogue}</dd></div></div>}</dl></CardContent></Card>)}</div>
    </> : <Button asChild><Link href={`/projects/${id}/analysis`}>查看分析进度<ArrowRight /></Link></Button>}
  </div>;
}
