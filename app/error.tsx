"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="py-20 text-center"><h1 className="text-2xl font-bold">暂时无法加载</h1><p className="mt-4 text-muted-foreground">请稍后再试一次。</p><Button onClick={reset} className="mt-8">重新加载</Button></div>;
}
