import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { EmptyWorkspace, ProjectCover, ReadyBadge, dateLabel } from "@/components/workspace/workspace-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getWorkspaceProjects } from "@/lib/workspace-dashboard";

export default async function PlansPage() { const projects = (await getWorkspaceProjects()).filter((project) => project.planReady); return <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10"><WorkspacePageHeader title="拍摄方案" description="把参考内容变成可以跟着完成的拍摄步骤。" />{projects.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <Card key={project.id}><ProjectCover project={project} /><CardContent><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{project.name}</h2><ReadyBadge ready /></div><p className="mt-3 text-sm text-muted-foreground">{project.shotCount} 个镜头 · 已完成 {project.capturedCount} 镜</p><p className="mt-2 text-xs text-muted-foreground">更新于 {dateLabel(project.updatedAt)}</p><Button asChild size="sm" className="mt-5 w-full"><Link href={`/projects/${project.id}/plan`}>查看方案<ArrowRight /></Link></Button></CardContent></Card>)}</div> : <EmptyWorkspace title="还没有拍摄方案" description="上传一个参考视频，AI 会为你生成逐镜拍摄方案。" action={<Button asChild><Link href="/projects/new">上传参考视频</Link></Button>} />}</div>; }
