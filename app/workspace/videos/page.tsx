import Link from "next/link";
import { Film } from "lucide-react";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { EmptyWorkspace, VideoCard } from "@/components/workspace/workspace-cards";
import { Button } from "@/components/ui/button";
import { getWorkspaceProjects } from "@/lib/workspace-dashboard";

export default async function VideosPage() {
  const projects = (await getWorkspaceProjects()).filter((project) => project.finalVideo?.status === "READY" && project.finalVideo.url);
  return <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10"><WorkspacePageHeader title="成片库" description="你的成片都在这里，可以随时播放和下载。" />
    {projects.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <VideoCard key={project.id} project={project} />)}</div> : <EmptyWorkspace title="还没有成片" description="完成拍摄后，AI 会把选中的镜头整理为成片。" action={<Button asChild><Link href="/workspace/shoot"><Film />查看拍摄任务</Link></Button>} />}
  </div>;
}
