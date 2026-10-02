"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StartProductionButton({ opportunityId, label }: { opportunityId: string; label: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function start() { setBusy(true); setError(null); try { const response = await fetch(`/api/content-opportunities/${opportunityId}/production`, { method: "POST" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "暂时无法开始制作。"); router.push(`/workspace/produce/${body.id}`); } catch (cause) { setError(cause instanceof Error ? cause.message : "暂时无法开始制作。"); setBusy(false); } }
  return <div><Button size="lg" className="w-full sm:w-auto" disabled={busy} onClick={() => void start()}>{busy ? "正在创建…" : label}</Button>{error && <p className="mt-2 text-sm text-red-700">{error}</p>}</div>;
}
