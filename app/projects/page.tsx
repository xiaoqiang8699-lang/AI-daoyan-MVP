import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Film, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { projectStatusLabels } from "@/lib/projects";

export default async function ProjectsPage() {
  const projects = await db.project.findMany({ where: { userId: DEMO_USER_ID }, include: { shootingPlan: { select: { status: true } }, _count: { select: { shots: true } }, shots: { orderBy: { order: "asc" }, take: 1 } }, orderBy: { createdAt: "desc" } });
  return <div>
    <div className="mb-9 flex flex-wrap items-center justify-between gap-5"><div><p className="mb-3 text-xs text-muted-foreground">创作空间</p><h1 className="text-3xl font-bold">我的拍摄项目</h1><p className="mt-3 text-sm text-muted-foreground">让喜欢的画面，成为自己的作品。</p></div>{projects.length > 0 && <Button asChild><Link href="/projects/new"><Plus />创建项目</Link></Button>}</div>
    {projects.length === 0 ? <Card className="py-14 text-center"><CardContent><Film className="mx-auto mb-5 size-9 text-muted-foreground" /><h2 className="text-lg font-medium">还没有拍摄项目。</h2><p className="mt-3 text-sm text-muted-foreground">选一个喜欢的视频，开始你的第一次创作。</p><Button asChild className="mt-7"><Link href="/projects/new">创建第一个项目<Plus /></Link></Button></CardContent></Card> : <div className="grid gap-5 sm:grid-cols-2">{projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="group min-w-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"><Card className="h-full transition-colors group-hover:border-primary/50"><div className="relative"><Image src={project.shots[0]?.referenceFrameUrl || "/mock/reference.svg"} alt={`${project.name}的参考画面`} width={640} height={400} className="aspect-[16/9] w-full object-cover" /><span className="absolute top-4 left-4 rounded-full bg-white/95 px-3 py-1.5 text-xs">{project.shootingPlan?.status === "READY" ? "方案已就绪" : projectStatusLabels[project.status]}</span>{project.analysisProvider === "mock" && <span className="absolute right-4 bottom-4 rounded-full bg-white/90 px-2 py-1 text-xs">示例方案</span>}</div><CardContent><div className="flex items-start justify-between gap-3"><h2 className="break-words text-lg font-semibold">{project.name}</h2><ArrowUpRight className="mt-1 size-5 shrink-0 text-muted-foreground group-hover:text-primary" /></div><p className="mt-3 text-xs text-muted-foreground">{project._count.shots} 个镜头<span className="mx-2">·</span>{project.createdAt.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })}</p></CardContent></Card></Link>)}</div>}
  </div>;
}
