import { AnalysisProgress } from "@/components/analysis-progress";
import { ProjectHeading } from "@/components/project-heading";
import { getProject } from "@/lib/projects";
import { getAnalysisState } from "@/lib/analysis";

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  const state = await getAnalysisState(id);
  return <div className="mx-auto max-w-xl"><ProjectHeading name={project.name} title="把灵感，拆成小步骤。" /><AnalysisProgress projectId={id} initialState={state} /></div>;
}
