import { redirect } from "next/navigation";
import { getProject } from "@/lib/projects";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  const needsAnalysis = project.status === "ANALYZING" || project.status === "ANALYSIS_FAILED" || project.shots.length === 0;
  if (needsAnalysis) redirect(`/projects/${id}/analysis`);
  redirect(`/projects/${id}/${project.shootingPlan?.status === "READY" ? "plan" : "brief"}`);
}
