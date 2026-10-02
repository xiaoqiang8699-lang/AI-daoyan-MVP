import { db } from "@/lib/db";
import { AnalyticsEvent } from "@/lib/analytics-events";

export default async function TestsPage() {
  const sessions = await db.userTestSession.findMany({ include: { project: { select: { name: true, finalVideo: { select: { status: true } } } }, feedback: true, events: { select: { eventName: true, createdAt: true }, orderBy: { createdAt: "desc" } } }, orderBy: { startedAt: "desc" } });
  return <div><h1 className="text-3xl font-bold">测试观察表</h1><div className="mt-6 space-y-3">{sessions.map((session) => {
    const latest = session.events[0]; const downloaded = session.events.some((event) => event.eventName === AnalyticsEvent.FINAL_VIDEO_DOWNLOADED); const elapsed = ((session.completedAt || new Date()).getTime() - session.startedAt.getTime()) / 60000;
    return <article key={session.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><strong>{session.testerLabel}</strong><span>{session.status}</span></div><p className="mt-2 text-sm text-muted-foreground">{session.testerType} · {session.experienceLevel} · {session.project?.name || "尚未创建项目"}</p><p className="mt-2 text-sm">当前阶段：{latest?.eventName || "尚未开始"}　总耗时：{elapsed.toFixed(1)} 分钟</p><p className="mt-2 text-sm">成片：{session.project?.finalVideo?.status === "READY" ? "已生成" : "未生成"}　下载：{downloaded ? "已下载" : "未下载"}　套餐：{session.selectedPlan || "未选择"}</p>{session.feedback && <p className="mt-2 text-sm">最有帮助：{session.feedback.mostHelpful}　复用：{session.feedback.reuseIntent}　发布：{session.feedback.publishIntent}</p>}</article>;
  })}</div></div>;
}
