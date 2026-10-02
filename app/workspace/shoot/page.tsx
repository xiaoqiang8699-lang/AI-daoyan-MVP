import Link from "next/link";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { EmptyWorkspace, ShootCard } from "@/components/workspace/workspace-cards";
import { Button } from "@/components/ui/button";
import { getWorkspaceProjects } from "@/lib/workspace-dashboard";

export default async function ShootWorkspacePage() { const projects = (await getWorkspaceProjects()).filter((project) => project.planReady && ["READY_TO_SHOOT", "SHOOTING"].includes(project.status)); return <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10"><WorkspacePageHeader title="拍摄导演" description="按镜头完成拍摄，随时可以补拍或继续。" />{projects.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{projects.map((project) => <ShootCard key={project.id} project={project} />)}</div> : <EmptyWorkspace title="没有待拍摄的项目" description="先完成拍摄方案，镜头任务会出现在这里。" action={<Button asChild><Link href="/workspace/plans">查看拍摄方案</Link></Button>} />}</div>; }
