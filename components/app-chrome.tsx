"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, FolderOpen } from "lucide-react";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/workspace")) return <>{children}</>;

  return <>
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5 sm:px-8">
        <Link href="/workspace" className="flex items-center gap-2.5 font-bold tracking-tight" aria-label="AI 导演首页">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white"><Clapperboard className="size-5" /></span>
          <span className="text-lg">AI 导演</span>
        </Link>
        <Link href="/projects" className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:text-primary"><FolderOpen className="size-4" />我的项目</Link>
      </div>
    </header>
    <main className="mx-auto min-h-[calc(100svh-160px)] max-w-5xl px-5 py-9 sm:px-8 sm:py-12">{children}</main>
    <footer className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-7 text-xs text-muted-foreground sm:px-8"><span>AI 导演</span><span>让每一个灵感，都有下一步。</span></footer>
  </>;
}
