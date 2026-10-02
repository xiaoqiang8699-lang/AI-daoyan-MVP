import "dotenv/config";
import { db } from "../lib/db";
import { ensureDemoUser, DEMO_USER_ID } from "../lib/demo-user";
import { MockVideoAIProvider } from "../packages/ai/providers/mock-video-ai-provider";

async function main() {
  await ensureDemoUser();
  const shots = await new MockVideoAIProvider().analyzeReferenceVideo({ fileUrl: "/mock/reference.svg", duration: 20 });
  await db.project.upsert({
    where: { id: "demo-project" },
    update: { analysisProvider: "mock" },
    create: {
      id: "demo-project", userId: DEMO_USER_ID, name: "一杯咖啡的慢时光", status: "READY_TO_SHOOT", analysisProvider: "mock",
      referenceVideo: { create: { fileUrl: "/mock/reference.svg", duration: 20 } },
      shots: { create: shots.map((shot) => ({ ...shot, referenceFrameUrl: `/mock/shot-${shot.order}.svg`, id: `demo-shot-${shot.order}`, status: "READY" })) },
    },
  });
  console.log("示例数据已就绪：http://localhost:3010/projects/demo-project/shots");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
