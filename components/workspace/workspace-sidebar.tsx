"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Clapperboard, Compass, Film, FolderOpen, Home, PackageOpen, Scissors, Sparkles, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/workspace", label: "首页", icon: Home },
  { href: "/workspace/materials", label: "今日素材", icon: PackageOpen },
  { href: "/workspace/opportunities", label: "内容机会", icon: Compass },
  { href: "/workspace/plans", label: "拍摄方案", icon: FolderOpen },
  { href: "/workspace/shoot", label: "拍摄导演", icon: Video },
  { href: "/workspace/editing", label: "自动剪辑", icon: Scissors },
  { href: "/workspace/videos", label: "成片库", icon: Film },
  { href: "/workspace/growth", label: "数据与成长", icon: BarChart3 },
];

export function WorkspaceSidebar() {
  const pathname = usePathname();
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-workspace-border bg-white px-4 py-6 lg:flex lg:flex-col">
    <Link href="/workspace" className="flex items-center gap-3 px-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white"><Clapperboard className="size-5" /></span>
      <span><strong className="block text-base">AI 导演</strong><span className="text-xs text-muted-foreground">你的个人内容导演</span></span>
    </Link>
    <nav className="mt-9 space-y-1" aria-label="工作台导航">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = href === "/workspace" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-workspace-soft hover:text-foreground", active && "bg-primary/10 text-primary")}><Icon className="size-4.5" />{label}</Link>;
      })}
    </nav>
    <div className="mt-auto border-t border-workspace-border pt-5">
      <p className="px-3 text-xs text-muted-foreground">创作者版</p>
      <Link href="/workspace/growth" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/8"><Sparkles className="size-4" />升级套餐</Link>
    </div>
  </aside>;
}
