import { BarChart3, Download, RotateCcw, Video } from "lucide-react";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getWorkspaceDashboard } from "@/lib/workspace-dashboard";

export default async function GrowthPage() {
  const { stats } = await getWorkspaceDashboard();
  const items = [
    { label: "已生成成片", value: stats.videos, icon: Video, description: "基于当前真实成片记录" },
    { label: "已拍摄镜头", value: stats.capturedShots, icon: BarChart3, description: "已保存的镜头数" },
    { label: "AI 建议重拍", value: stats.retakes, icon: RotateCcw, description: "基于 AI 检查事件" },
    { label: "下载成片", value: stats.downloads, icon: Download, description: "基于下载行为记录" },
  ];
  return <div className="mx-auto max-w-6xl p-5 sm:p-8 lg:p-10"><WorkspacePageHeader title="数据与成长" description="查看你在 AI 导演里的真实创作进展。" action={false} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(({ label, value, icon: Icon, description }) => <Card key={label}><CardContent><Icon className="size-5 text-primary" /><p className="mt-5 text-3xl font-bold">{value}</p><h2 className="mt-2 font-medium">{label}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p></CardContent></Card>)}</div><Card className="mt-7"><CardContent><h2 className="font-semibold">持续创作，从一条内容开始</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">这里显示的是当前项目真实可计算的数据。内容机会和更完整的成长分析会在后续版本逐步开放。</p></CardContent></Card></div>;
}
