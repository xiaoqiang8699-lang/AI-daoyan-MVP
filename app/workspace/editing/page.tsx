import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { EditCard, EmptyWorkspace } from "@/components/workspace/workspace-cards";
import { Button } from "@/components/ui/button";
import { getWorkspaceProjects } from "@/lib/workspace-dashboard";

export default async function EditingPage() {
  const projects = (await getWorkspaceProjects()).filter((project) => project.finalVideo && ["PENDING", "RENDERING", "FAILED"].includes(project.finalVideo.status));
  return <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10"><WorkspacePageHeader title="自动剪辑" description="查看正在生成、等待生成或需要重新处理的成片。" />
    {projects.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <EditCard key={project.id} project={project} />)}</div> : <EmptyWorkspace title="没有正在剪辑的项目" description="当镜头拍摄完成后，可以在项目中生成成片。" action={<Button asChild><Link href="/workspace/shoot"><Clapperboard />查看拍摄任务</Link></Button>} />}
  </div>;
}
