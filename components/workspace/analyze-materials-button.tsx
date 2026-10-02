"use client";
import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AnalyzeMaterialsButton({ batchId }: { batchId: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function start() { setBusy(true); setMessage(""); try { const response = await fetch(`/api/material-batches/${batchId}/analyze`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMessage("已开始整理，稍后刷新即可查看机会。"); } catch (error) { setMessage(error instanceof Error ? error.message : "无法开始整理。"); } finally { setBusy(false); } }
  return <div className="text-right"><Button type="button" disabled={busy} onClick={() => void start()}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}让 AI 整理</Button>{message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}</div>;
}
