"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {}, []);
  return <div className="mx-auto max-w-xl p-8 text-center sm:pt-24"><h1 className="text-2xl font-bold">暂时无法加载工作台</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">请稍后重试。你的项目和拍摄内容不会受影响。</p><Button className="mt-6" onClick={reset}>重新加载</Button></div>;
}
