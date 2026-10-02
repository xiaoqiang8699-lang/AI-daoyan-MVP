"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Home, PackageOpen, UserRound, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/workspace", label: "首页", icon: Home },
  { href: "/workspace/materials", label: "素材", icon: PackageOpen },
  { href: "/workspace/shoot", label: "拍摄", icon: Video },
  { href: "/workspace/videos", label: "成片", icon: Film },
  { href: "/workspace/growth", label: "我的", icon: UserRound },
];

export function WorkspaceMobileNav() {
  const pathname = usePathname();
  return <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-workspace-border bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="移动端导航">
    {nav.map(({ href, label, icon: Icon }) => {
      const active = href === "/workspace" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} className={cn("flex flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground", active && "text-primary")}><Icon className="size-5" /><span>{label}</span></Link>;
    })}
  </nav>;
}
