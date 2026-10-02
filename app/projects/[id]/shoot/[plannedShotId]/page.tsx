import { notFound } from "next/navigation";
import { CaptureWorkflow } from "@/components/capture-workflow";
import { getProjectWithShootingPlan } from "@/lib/shooting-plan";

export default async function ShootPage({ params, searchParams }: { params: Promise<{ id: string; plannedShotId: string }>; searchParams: Promise<{ debugEvaluation?: string }> }) {
  const { id, plannedShotId } = await params;
  const query = await searchParams;
  const project = await getProjectWithShootingPlan(id);
  const plan = project.shootingPlan;
  if (!plan || plan.status !== "READY" || !project.referenceVideo) notFound();
  const index = plan.shots.findIndex((shot) => shot.id === plannedShotId);
  if (index === -1) notFound();
  const shot = plan.shots[index];
  const reference = project.shots.find((item) => item.id === shot.referenceShotId);
  if (!reference) notFound();
  const viewTake = (take: NonNullable<typeof shot.selectedTake>) => ({
    id: take.id,
    videoUrl: take.videoUrl,
    duration: take.duration,
    width: take.width,
    height: take.height,
    mimeType: take.mimeType,
    acceptanceStatus: take.acceptanceStatus,
    createdAt: take.createdAt.toISOString(),
    evaluation: take.evaluation ? {
      status: take.evaluation.status,
      overallScore: take.evaluation.overallScore,
      framingScore: take.evaluation.framingScore,
      actionScore: take.evaluation.actionScore,
      movementScore: take.evaluation.movementScore,
      timingScore: take.evaluation.timingScore,
      visibilityScore: take.evaluation.visibilityScore,
      criticalIssues: take.evaluation.criticalIssues,
      mainIssue: take.evaluation.mainIssue,
      advice: take.evaluation.advice,
      confidence: take.evaluation.confidence,
      provider: take.evaluation.provider,
      model: take.evaluation.model,
      evidence: take.evaluation.evidence,
      error: take.evaluation.error,
    } : null,
  });
  const selectedTake = shot.selectedTake ? viewTake(shot.selectedTake) : null;

  return <CaptureWorkflow
    projectId={id}
    shot={{
      id: shot.id,
      order: shot.order,
      purpose: shot.purpose,
      actionInstruction: shot.actionInstruction,
      cameraInstruction: shot.cameraInstruction,
      dialogue: shot.dialogue,
      targetDuration: shot.targetDuration,
      captureStatus: shot.captureStatus,
      selectedTake,
      takeCount: shot.takes.length,
      takes: shot.takes.map((take) => viewTake(take)!),
      reference: {
        frameUrl: reference.referenceFrameUrl || "/mock/reference.svg",
        startTime: reference.startTime,
        endTime: reference.endTime,
      },
    }}
    allShots={plan.shots.map((item) => ({ id: item.id, order: item.order, captureStatus: item.captureStatus }))}
    shotIndex={index}
    nextShotId={plan.shots[index + 1]?.id || null}
    referenceVideo={{
      url: project.referenceVideo.fileUrl,
      orientation: project.referenceVideo.width && project.referenceVideo.height
        ? project.referenceVideo.width > project.referenceVideo.height ? "landscape" : "portrait"
        : "unknown",
    }}
    debugEvaluation={process.env.NODE_ENV !== "production" && query.debugEvaluation === "1"}
  />;
}
