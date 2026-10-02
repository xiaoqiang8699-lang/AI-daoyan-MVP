import { ProjectHeading } from "@/components/project-heading";
import { FinalVideoPanel } from "@/components/final-video-panel";
import { TestFeedbackSurvey } from "@/components/test-feedback-survey";
import { PricingExperiment } from "@/components/pricing-experiment";
import { StageFeedback } from "@/components/stage-feedback";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { getFinalVideoView } from "@/lib/final-video";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getFinalVideoView(id);
  const session = await db.userTestSession.findFirst({ where: { projectId: id, userId: DEMO_USER_ID }, select: { pricingVariant: true } });
  return <div className="mx-auto max-w-xl"><ProjectHeading name={view.projectName} title="你的成片" description="当前采用的镜头会按拍摄方案顺序拼接。" /><FinalVideoPanel projectId={id} initial={view} /><StageFeedback projectId={id} stage="RESULT" />{session && view.finalVideo?.status === "READY" && <><TestFeedbackSurvey projectId={id} /><PricingExperiment projectId={id} variant={session.pricingVariant} /></>}</div>;
}
