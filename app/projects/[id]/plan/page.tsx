import Link from "next/link";
import { ProjectHeading } from "@/components/project-heading";
import { ShootingPlanView } from "@/components/shooting-plan-view";
import { FinalVideoPanel } from "@/components/final-video-panel";
import { Button } from "@/components/ui/button";
import { getFinalVideoView } from "@/lib/final-video";
import { getProjectWithShootingPlan } from "@/lib/shooting-plan";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectWithShootingPlan(id);
  const plan = project.shootingPlan;
  if (!plan || plan.status !== "READY" || !plan.shots.length) return <div className="mx-auto max-w-xl"><ProjectHeading name={project.name} title="你的拍摄方案还没有准备好" description={plan?.generationError || "先告诉 AI 你准备拍什么。"} /><Button asChild><Link href={`/projects/${id}/brief`}>填写拍摄需求</Link></Button></div>;
  const referenceById = new Map(project.shots.map((shot) => [shot.id, shot]));
  const shots = plan.shots.map((shot) => {
    const reference = referenceById.get(shot.referenceShotId)!;
    return {
      id: shot.id,
      order: shot.order,
      purpose: shot.purpose,
      actionInstruction: shot.actionInstruction,
      cameraInstruction: shot.cameraInstruction,
      dialogue: shot.dialogue,
      targetDuration: shot.targetDuration,
      difficulty: shot.difficulty,
      notes: shot.notes,
      reference: {
        referenceFrameUrl: reference.referenceFrameUrl,
        shotSize: reference.shotSize,
        cameraMovement: reference.cameraMovement,
        visualDescription: reference.visualDescription,
        dialogue: reference.dialogue,
      },
    };
  });
  const estimatedMinutes = Math.max(1, Math.ceil((shots.reduce((sum, shot) => sum + shot.targetDuration, 0) + shots.length * 30) / 60));
  const finalVideo = await getFinalVideoView(id);
  return <div><ProjectHeading name={project.name} title="你的拍摄方案" description="默认展示适合你的拍法，需要时可以展开查看原参考镜头。" /><ShootingPlanView projectId={id} initialShots={shots} estimatedMinutes={estimatedMinutes} /><FinalVideoPanel projectId={id} initial={finalVideo} /></div>;
}
