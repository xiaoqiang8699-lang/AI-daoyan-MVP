import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";

export async function getProject(id: string) {
  const project = await db.project.findFirst({
    where: { id, userId: DEMO_USER_ID },
    include: { referenceVideo: true, shootingPlan: { select: { id: true, status: true } }, shots: { orderBy: { order: "asc" } } },
  });
  if (!project) notFound();
  return project;
}

export const projectStatusLabels = {
  DRAFT: "待准备", ANALYZING: "正在分析", ANALYSIS_FAILED: "分析失败", READY_TO_SHOOT: "参考已分析", SHOOTING: "拍摄中", COMPLETED: "已完成",
};
