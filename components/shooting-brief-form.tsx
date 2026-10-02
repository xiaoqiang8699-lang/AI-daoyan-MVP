"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BriefValue = {
  subject: string;
  talentMode: "SELF" | "OTHER_PERSON" | "PRODUCT_ONLY";
  location: string;
  additionalContext: string;
};

const talentOptions = [
  ["SELF", "我自己"],
  ["OTHER_PERSON", "其他人"],
  ["PRODUCT_ONLY", "只拍产品"],
] as const;

export function ShootingBriefForm({ projectId, initialValue, hasPlan }: { projectId: string; initialValue: BriefValue; hasPlan: boolean }) {
  const router = useRouter();
  const [talentMode, setTalentMode] = useState(initialValue.talentMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = String(form.get("subject") || "").trim();
    if (!subject) return setError("请告诉 AI 你要拍什么。");
    setBusy(true);
    setError("");
    try {
      const briefResponse = await fetch(`/api/projects/${projectId}/brief`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          talentMode,
          location: String(form.get("location") || "").trim(),
          additionalContext: String(form.get("additionalContext") || "").trim() || null,
        }),
      });
      const briefData = await briefResponse.json() as { error?: string };
      if (!briefResponse.ok) throw new Error(briefData.error || "拍摄需求保存失败，请重试。");
      const planResponse = await fetch(`/api/projects/${projectId}/plan`, { method: "POST" });
      const planData = await planResponse.json() as { error?: string };
      if (!planResponse.ok) throw new Error(planData.error || "拍摄方案生成失败，请重试。");
      router.push(`/projects/${projectId}/plan`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成失败，请稍后重试。");
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-7 rounded-2xl border border-border bg-card p-5 sm:p-7">
    <div><label htmlFor="subject" className="mb-3 block text-sm font-medium">你要拍什么？</label><textarea id="subject" name="subject" required maxLength={1000} disabled={busy} defaultValue={initialValue.subject} rows={5} placeholder="例如：我要拍一件秋季针织开衫，重点展示版型和面料。" className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-base leading-7 outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50" /></div>
    <fieldset disabled={busy}><legend className="mb-3 text-sm font-medium">谁出镜？</legend><div className="grid grid-cols-3 gap-2">{talentOptions.map(([value, label]) => <label key={value} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm transition-colors ${talentMode === value ? "border-primary bg-primary/5 text-primary" : "border-border bg-card"}`}><input type="radio" name="talentMode" value={value} checked={talentMode === value} onChange={() => setTalentMode(value)} className="sr-only" />{label}</label>)}</div></fieldset>
    <div><label htmlFor="location" className="mb-3 block text-sm font-medium">在哪里拍？</label><Input id="location" name="location" maxLength={300} disabled={busy} defaultValue={initialValue.location} placeholder="例如：我的服装店、家里客厅、户外街道" /></div>
    <div><label htmlFor="additionalContext" className="mb-3 block text-sm font-medium">其他要求 <span className="font-normal text-muted-foreground">（可选）</span></label><textarea id="additionalContext" name="additionalContext" maxLength={1000} disabled={busy} defaultValue={initialValue.additionalContext} rows={3} placeholder="例如：不要太专业，希望一个人也能完成。" className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-base leading-7 outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20 disabled:opacity-50" /></div>
    {error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}
    <Button type="submit" disabled={busy} className="w-full">{busy ? <><LoaderCircle className="animate-spin" />正在生成你的方案……</> : <>{hasPlan ? "重新生成我的方案" : "生成我的拍摄方案"}<ArrowRight /></>}</Button>
    {busy && <p role="status" className="text-center text-xs leading-6 text-muted-foreground">正在根据参考镜头重新设计动作、机位和台词，请不要关闭页面。</p>}
  </form>;
}
