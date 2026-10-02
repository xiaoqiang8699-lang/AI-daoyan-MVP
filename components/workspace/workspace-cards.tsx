import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Download, Film, Play, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkspaceProject } from "@/lib/workspace-dashboard";

export function dateLabel(value: string) { return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }).format(new Date(value)); }
export function durationLabel(duration: number | null) { return duration ? `${duration.toFixed(duration < 10 ? 1 : 0)} 秒` : "视频"; }

export function ProjectCover({ project, className = "aspect-video" }: { project: WorkspaceProject; className?: string }) {
  return <div className={`relative overflow-hidden bg-workspace-soft ${className}`}>{project.coverUrl ? <Image src={project.coverUrl} alt={`${project.name}封面`} width={720} height={405} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-primary/70"><Film className="size-8" /></div>}</div>;
}

export function VideoCard({ project }: { project: WorkspaceProject }) {
  const video = project.finalVideo!;
  return <Card className="group"><ProjectCover project={project} /><CardContent><h2 className="line-clamp-1 font-semibold">{project.name}</h2><p className="mt-2 text-xs text-muted-foreground">{durationLabel(video.duration)}<span className="mx-2">·</span>{dateLabel(project.updatedAt)}</p><div className="mt-4 flex gap-2"><Button asChild size="sm" variant="outline" className="flex-1"><Link href={`/projects/${project.id}/result`}><Play />查看</Link></Button>{video.url && <Button asChild size="sm" className="flex-1"><a href={video.url} download><Download />下载</a></Button>}</div></CardContent></Card>;
}

export function ShootCard({ project }: { project: WorkspaceProject }) {
  const href = project.firstShotId ? `/projects/${project.id}/shoot/${project.firstShotId}` : `/projects/${project.id}/plan`;
  return <Card><CardContent><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">拍摄中</p><h2 className="mt-2 font-semibold">{project.name}</h2></div><Video className="size-5 text-primary" /></div><p className="mt-3 text-sm text-muted-foreground">已完成 {project.capturedCount} / {project.shotCount} 镜</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${project.shotCount ? project.capturedCount / project.shotCount * 100 : 0}%` }} /></div><Button asChild size="sm" className="mt-5 w-full"><Link href={href}>继续拍摄<ArrowRight /></Link></Button></CardContent></Card>;
}

export function EditCard({ project }: { project: WorkspaceProject }) {
  const failed = project.finalVideo?.status === "FAILED";
  return <Card><CardContent><p className={`text-xs font-medium ${failed ? "text-red-600" : "text-primary"}`}>{failed ? "剪辑需要处理" : "正在自动剪辑"}</p><h2 className="mt-2 font-semibold">{project.name}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{failed ? "这次成片未生成，请进入项目后重新尝试。" : "正在整理镜头与生成成片，请稍后查看。"}</p><Button asChild size="sm" variant="outline" className="mt-5 w-full"><Link href={`/projects/${project.id}/result`}>查看进度</Link></Button></CardContent></Card>;
}

export function EmptyWorkspace({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <Card className="border-dashed"><CardContent className="py-10 text-center"><Sparkles className="mx-auto size-7 text-primary" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</CardContent></Card>;
}

export function ReadyBadge({ ready }: { ready: boolean }) { return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${ready ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{ready && <Check className="size-3" />}{ready ? "方案已就绪" : "准备中"}</span>; }
