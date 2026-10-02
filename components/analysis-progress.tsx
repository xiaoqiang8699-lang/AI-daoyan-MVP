"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Circle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisState } from "@/lib/analysis-state";

export function AnalysisProgress({ projectId, initialState }: { projectId: string; initialState: AnalysisState }) {
  const [state, setState] = useState(initialState);
  const [requestError, setRequestError] = useState("");
  const [running, setRunning] = useState(initialState.status === "ANALYZING");
  const pollTimer = useRef<number | null>(null);

  const run = useCallback(async (retry = false) => {
    setRunning(true);
    setRequestError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/analysis${retry ? "?retry=true" : ""}`, { method: "POST" });
      const data = await response.json() as AnalysisState & { error?: string };
      if (!response.ok) throw new Error(data.error || "分析请求失败");
      setState(data);
      if (data.status === "ANALYZING") {
        pollTimer.current = window.setInterval(async () => {
          const check = await fetch(`/api/projects/${projectId}/analysis`, { cache: "no-store" });
          const next = await check.json() as AnalysisState;
          setState(next);
          if (next.status !== "ANALYZING" && pollTimer.current !== null) {
            window.clearInterval(pollTimer.current);
            pollTimer.current = null;
            setRunning(false);
          }
        }, 2500);
      } else setRunning(false);
    } catch (error) {
      setRunning(false);
      setRequestError(error instanceof Error ? error.message : "连接暂时中断，请重试。");
    }
  }, [projectId]);

  useEffect(() => {
    if (initialState.status !== "ANALYZING") return;
    const timer = window.setTimeout(() => void run(false), 0);
    return () => window.clearTimeout(timer);
  }, [initialState.status, run]);
  useEffect(() => () => {
    if (pollTimer.current !== null) window.clearInterval(pollTimer.current);
  }, []);
  const complete = state.status === "READY_TO_SHOOT";
  const failed = state.status === "ANALYSIS_FAILED" || !!requestError;
  const steps = ["正在看视频", "正在识别镜头", "正在整理拍摄步骤"];
  return <div className="rounded-2xl border border-border bg-card px-5 py-10 sm:px-8">
    <div className="text-center"><span className={`mx-auto flex size-16 items-center justify-center rounded-2xl ${complete ? "bg-[#edf1d3]" : failed ? "bg-red-50 text-red-700" : "bg-primary/10 text-primary"}`}>{complete ? <Check className="size-7" /> : failed ? <Circle className="size-7" /> : <LoaderCircle className="size-7 animate-spin motion-reduce:animate-none" />}</span>
      <div role="status" aria-live="polite"><h2 className="mt-6 text-xl font-semibold">{failed ? "这次没有成功分析视频" : complete ? `分析完成，共发现 ${state.shotCount} 个镜头` : "正在分析你的参考视频"}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{failed ? requestError || state.error : complete ? "参考结构已经整理好，接下来把它改成你的内容。" : "视频越长，需要等待的时间可能越久。"}</p></div>
    </div>
    {!complete && !failed && <div className="mx-auto mt-8 max-w-xs space-y-4">{steps.map((step, index) => <div className="flex items-center gap-3 text-sm" key={step}><span className={`flex size-6 items-center justify-center rounded-full ${index === 0 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{index === 0 ? <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" /> : index + 1}</span>{step}</div>)}</div>}
    <div className="mt-8 text-center">{failed && <Button disabled={running} onClick={() => void run(true)}>{running ? "正在重新分析……" : "重新分析"}</Button>}{complete && <Button asChild><Link href={`/projects/${projectId}/brief`}>生成我的拍摄方案<ArrowRight /></Link></Button>}</div>
  </div>;
}
