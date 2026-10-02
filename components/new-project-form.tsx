"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_BYTES = 200 * 1024 * 1024;
const allowed = new Set(["mp4", "mov", "webm"]);

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function validate(file: File | null) {
  if (!file) return "请先选择一个参考视频。";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !allowed.has(extension)) return "视频格式不支持，请选择 MP4、MOV 或 WebM 视频。";
  if (file.size <= 0) return "视频文件为空，请重新选择。";
  if (file.size > MAX_BYTES) return "视频过大，最大支持 200MB。";
  return "";
}

export function NewProjectForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "processing">("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "").trim();
    const fileError = validate(file);
    if (!name || name.length > 80) return setError("请输入 1 至 80 个字的项目名称。");
    if (fileError || !file) return setError(fileError);
    setError("");
    setStatus("uploading");
    setProgress(0);
    const request = new XMLHttpRequest();
    request.open("POST", "/api/projects");
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.setRequestHeader("X-Project-Name", encodeURIComponent(name));
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    request.setRequestHeader("X-File-Size", String(file.size));
    request.upload.onprogress = (upload) => {
      if (upload.lengthComputable) setProgress(Math.min(100, Math.round(upload.loaded / upload.total * 100)));
    };
    request.upload.onload = () => setStatus("processing");
    request.onerror = () => { setStatus("idle"); setError("上传中断了，请检查网络后重试。"); };
    request.onload = () => {
      let data: { projectId?: string; error?: string } = {};
      try { data = JSON.parse(request.responseText); } catch { /* handled below */ }
      if (request.status === 201 && data.projectId) router.push(`/projects/${data.projectId}/analysis`);
      else { setStatus("idle"); setError(data.error || "视频上传失败，请重试。"); }
    };
    request.send(file);
  }

  const busy = status !== "idle";
  return <form onSubmit={submit} className="space-y-7">
    <div><label htmlFor="name" className="mb-3 block text-sm font-medium">项目名称</label><Input id="name" name="name" placeholder="比如：属于我的周末早晨" required maxLength={80} disabled={busy} /><p className="mt-2 text-xs text-muted-foreground">给这次创作起个名字。</p></div>
    <div><span className="mb-3 block text-sm font-medium">参考视频</span><label className="relative flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-primary/35 bg-primary/[0.025] px-5 py-9 text-center focus-within:ring-2 focus-within:ring-ring"><input aria-label="选择参考视频" type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" disabled={busy} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(event) => {
      const selected = event.target.files?.[0] || null;
      const message = validate(selected);
      setError(message);
      if (preview) URL.revokeObjectURL(preview);
      setFile(message ? null : selected);
      setPreview(selected && !message ? URL.createObjectURL(selected) : null);
      if (message) event.target.value = "";
    }} /><span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-white text-primary">{file ? <Check className="size-5" /> : <Upload className="size-5" />}</span><span className="max-w-full break-all text-sm font-medium">{file ? file.name : "点击选择一个参考视频"}</span><span className="mt-2 text-xs leading-6 text-muted-foreground">{file ? `${formatBytes(file.size)} · 已选择` : "支持 MP4、MOV、WebM，最大 200MB。"}</span></label>
      {preview && <video key={preview} src={preview} controls className="mt-4 max-h-72 w-full rounded-xl bg-black" aria-label="所选参考视频预览" />}
      {busy && <div className="mt-4" role="status" aria-live="polite"><div className="mb-2 flex justify-between text-xs"><span>{status === "uploading" ? "正在上传视频" : "正在读取视频信息"}</span><span>{status === "uploading" ? `${progress}%` : "请稍候"}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full bg-primary transition-[width] ${status === "processing" ? "w-full animate-pulse motion-reduce:animate-none" : ""}`} style={status === "uploading" ? { width: `${progress}%` } : undefined} /></div></div>}
    </div>
    {error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}
    <Button type="submit" disabled={busy} className="w-full">{busy ? "正在保存视频……" : "开始分析"}<ArrowRight /></Button>
  </form>;
}
