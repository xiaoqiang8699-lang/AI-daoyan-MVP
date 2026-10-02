"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, LoaderCircle } from "lucide-react";

export function MaterialsDropzone({ initialBatchId }: { initialBatchId?: string }) {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("支持 MP4、MOV、WebM、JPG、PNG、WebP，单条不超过 200MB。");
  async function upload(files: FileList | File[]) {
    const items = Array.from(files); if (!items.length || busy) return; setBusy(true);
    try {
      let batchId = initialBatchId;
      if (!batchId) { const response = await fetch("/api/material-batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); batchId = data.id; }
      for (let index = 0; index < items.length; index += 1) { const file = items[index]; setMessage(`正在上传 ${index + 1} / ${items.length}…`); const response = await fetch(`/api/material-batches/${batchId}/assets`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-File-Size": String(file.size) }, body: file }); const data = await response.json(); if (!response.ok) throw new Error(data.error); }
      setMessage("素材已保存，正在刷新页面。"); router.push(`/workspace/materials?batch=${batchId}`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "上传失败，请重试。"); } finally { setBusy(false); }
  }
  return <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files); }} className="rounded-2xl border border-dashed border-workspace-border bg-white p-6 text-center">
    {busy ? <LoaderCircle className="mx-auto size-8 animate-spin text-primary" /> : <FileUp className="mx-auto size-8 text-primary" />}<h2 className="mt-4 font-semibold">添加今日素材</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
    <label className="mt-5 inline-flex h-10 cursor-pointer items-center rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-muted">选择文件<input ref={input} className="sr-only" type="file" multiple accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => void upload(event.currentTarget.files || [])} /></label>
  </div>;
}
