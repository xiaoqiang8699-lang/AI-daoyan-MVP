import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <div className="py-20 text-center"><h1 className="text-2xl font-bold">没有找到这个页面</h1><p className="mt-4 text-muted-foreground">项目或镜头可能不存在，回到项目列表再看看。</p><Button asChild className="mt-8"><Link href="/projects">返回我的项目</Link></Button></div>;
}
