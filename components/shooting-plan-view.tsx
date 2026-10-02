"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, ChevronDown, ChevronUp, LoaderCircle, MessageCircle, PersonStanding, RefreshCw, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PlanShot = {
  id: string;
  order: number;
  purpose: string;
  actionInstruction: string;
  cameraInstruction: string;
  dialogue: string | null;
  targetDuration: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  notes: string | null;
  reference: {
    referenceFrameUrl: string | null;
    shotSize: string;
    cameraMovement: string;
    visualDescription: string;
    dialogue: string | null;
  };
};

const difficultyLabels = { EASY: "简单", MEDIUM: "需要配合", HARD: "稍有难度" } as const;

export function ShootingPlanView({ projectId, initialShots, estimatedMinutes }: { projectId: string; initialShots: PlanShot[]; estimatedMinutes: number }) {
  const router = useRouter();
  const [shots, setShots] = useState(initialShots);
  const [referenceOpen, setReferenceOpen] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);
  const [error, setError] = useState("");

  async function regenerateShot(shot: PlanShot) {
    setBusyId(shot.id);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/plan/${shot.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const data = await response.json() as { shot?: Partial<PlanShot> & { id: string }; error?: string };
      if (!response.ok || !data.shot) throw new Error(data.error || "这一镜暂时无法重新生成。");
      setShots((current) => current.map((item) => item.id === shot.id ? { ...item, ...data.shot, reference: item.reference } : item));
      setEditingId(null);
      setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "这一镜暂时无法重新生成。");
    } finally { setBusyId(null); }
  }

  async function regeneratePlan() {
    setRegeneratingPlan(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/plan`, { method: "POST" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "整套方案暂时无法重新生成。");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "整套方案暂时无法重新生成。");
    } finally { setRegeneratingPlan(false); }
  }

  return <>
    <div className="mb-7 rounded-2xl bg-[#eeeee5] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-medium">共 {shots.length} 个镜头</p><p className="mt-1 text-xs text-muted-foreground">预计拍摄约 {estimatedMinutes} 分钟</p></div><Button asChild variant="outline" size="sm"><Link href={`/projects/${projectId}/brief`}>修改拍摄需求</Link></Button></div></div>
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-6 sm:grid-cols-2">{shots.map((shot) => {
      const showReference = !!referenceOpen[shot.id];
      const editing = editingId === shot.id;
      return <Card key={shot.id}><div className="relative"><Image src={shot.reference.referenceFrameUrl || "/mock/reference.svg"} alt={`镜头 ${shot.order} 的参考画面`} width={640} height={400} loading={shot.order <= 2 ? "eager" : "lazy"} className="aspect-[16/10] w-full object-cover" /><span className="absolute top-4 left-4 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium">镜头 {String(shot.order).padStart(2, "0")}</span><span className="absolute right-4 bottom-4 rounded-lg bg-white/90 px-2 py-1 text-xs">约 {shot.targetDuration} 秒</span></div><CardContent>
        <div className="mb-5 flex items-center justify-between gap-3"><span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary">{difficultyLabels[shot.difficulty]}</span><button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary" onClick={() => setReferenceOpen((current) => ({ ...current, [shot.id]: !showReference }))}>{showReference ? "收起参考" : "看参考"}{showReference ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}</button></div>
        {showReference && <div className="mb-5 rounded-xl bg-muted/70 p-4 text-sm"><p className="mb-3 text-xs font-medium text-muted-foreground">参考视频</p><p className="leading-6">{shot.reference.visualDescription}</p><p className="mt-2 text-xs text-muted-foreground">{shot.reference.shotSize} · {shot.reference.cameraMovement}</p>{shot.reference.dialogue && <p className="mt-2 leading-6">台词：{shot.reference.dialogue}</p>}</div>}
        <dl className="space-y-4">{[
          { icon: Target, label: "这一镜的作用", value: shot.purpose },
          { icon: PersonStanding, label: "你要做什么", value: shot.actionInstruction },
          { icon: Camera, label: "手机怎么拍", value: shot.cameraInstruction },
          ...(shot.dialogue ? [{ icon: MessageCircle, label: "台词", value: shot.dialogue }] : []),
          ...(shot.notes ? [{ icon: Sparkles, label: "小提示", value: shot.notes }] : []),
        ].map(({ icon: Icon, label, value }) => <div className="flex gap-3" key={label}><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd className="text-sm leading-6">{value}</dd></div></div>)}</dl>
        {editing ? <div className="mt-6 rounded-xl border border-border p-4"><label htmlFor={`reason-${shot.id}`} className="mb-2 block text-sm font-medium">为什么想换？ <span className="font-normal text-muted-foreground">（可选）</span></label><textarea id={`reason-${shot.id}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} disabled={busyId === shot.id} placeholder="例如：我这里只有一个人，没法让别人跟拍。" className="w-full resize-y rounded-xl border border-border px-3 py-2 text-sm leading-6 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20" /><div className="mt-3 flex gap-2"><Button size="sm" disabled={busyId === shot.id} onClick={() => void regenerateShot(shot)}>{busyId === shot.id ? <><LoaderCircle className="animate-spin" />正在换……</> : "生成替代拍法"}</Button><Button size="sm" variant="ghost" disabled={busyId === shot.id} onClick={() => { setEditingId(null); setReason(""); }}>取消</Button></div></div> : <Button variant="ghost" size="sm" className="mt-5" onClick={() => { setEditingId(shot.id); setReason(""); setError(""); }}><RefreshCw />换个拍法</Button>}
      </CardContent></Card>;
    })}</div>
    <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-center"><Button asChild className="w-full sm:w-auto"><Link href={`/projects/${projectId}/shoot/${shots[0]?.id}`}>开始拍摄<ArrowRight /></Link></Button><div className="mt-4"><button type="button" disabled={regeneratingPlan} onClick={() => void regeneratePlan()} className="text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-50">{regeneratingPlan ? "正在重新生成整套方案……" : "重新生成整套方案"}</button></div></div>
  </>;
}
