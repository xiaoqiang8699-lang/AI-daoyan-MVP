import { redirect } from "next/navigation";
import { ProjectHeading } from "@/components/project-heading";
import { ShootingBriefForm } from "@/components/shooting-brief-form";
import { getProjectWithShootingPlan } from "@/lib/shooting-plan";

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithShootingPlan(id);
  if (!project.shots.length) redirect(`/projects/${id}/analysis`);
  const brief = project.shootingBrief;
  return <div className="mx-auto max-w-xl">
    <ProjectHeading name={project.name} title="把它变成你的视频" description="告诉 AI 你准备拍什么，它会根据参考视频为你重新设计每一个镜头。" />
    <ShootingBriefForm projectId={id} hasPlan={project.shootingPlan?.status === "READY"} initialValue={{
      subject: brief?.subject || "",
      talentMode: brief?.talentMode || "SELF",
      location: brief?.location || "",
      additionalContext: brief?.additionalContext || "",
    }} />
  </div>;
}
