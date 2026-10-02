"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, History, Images, List, LoaderCircle, RefreshCw, RotateCcw, SwitchCamera, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type CaptureStatus = "NOT_STARTED" | "CAPTURED" | "SKIPPED";
type Phase = "PREPARE" | "CAMERA_READY" | "RECORDING" | "REVIEW";
type EvaluationStatus = "PENDING" | "EVALUATING" | "PASSED" | "NEEDS_RETAKE" | "FAILED";
type EvaluationView = {
  status: EvaluationStatus;
  overallScore: number | null;
  framingScore: number | null;
  actionScore: number | null;
  movementScore: number | null;
  timingScore: number | null;
  visibilityScore: number | null;
  criticalIssues: string[];
  mainIssue: string | null;
  advice: string | null;
  confidence: number | null;
  provider: string | null;
  model: string | null;
  evidence: string | null;
  error: string | null;
};
type TakeView = {
  id: string;
  videoUrl: string;
  duration: number;
  width: number;
  height: number;
  mimeType: string;
  acceptanceStatus: "NOT_ACCEPTED" | "AI_PASSED" | "USER_ACCEPTED";
  createdAt: string;
  evaluation: EvaluationView | null;
};
type LocalClip = { blob: Blob; url: string; fileName: string; duration: number | null };
type CaptureShot = {
  id: string;
  order: number;
  purpose: string;
  actionInstruction: string;
  cameraInstruction: string;
  dialogue: string | null;
  targetDuration: number;
  captureStatus: CaptureStatus;
  selectedTake: TakeView | null;
  takeCount: number;
  takes: TakeView[];
  reference: { frameUrl: string; startTime: number; endTime: number };
};

const MIME_CANDIDATES = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const MAX_TAKE_BYTES = 100 * 1024 * 1024;

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

function extensionForMime(mime: string) {
  const base = mime.split(";")[0];
  return base === "video/mp4" ? "mp4" : base === "video/quicktime" ? "mov" : "webm";
}

export function CaptureWorkflow({ projectId, shot, allShots, shotIndex, nextShotId, referenceVideo, debugEvaluation }: {
  projectId: string;
  shot: CaptureShot;
  allShots: { id: string; order: number; captureStatus: CaptureStatus }[];
  shotIndex: number;
  nextShotId: string | null;
  referenceVideo: { url: string; orientation: "portrait" | "landscape" | "unknown" };
  debugEvaluation: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("PREPARE");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<LocalClip | null>(null);
  const [selectedTake, setSelectedTake] = useState<TakeView | null>(shot.selectedTake);
  const [takeCount, setTakeCount] = useState(shot.takeCount);
  const [takeHistory, setTakeHistory] = useState<TakeView[]>(shot.takes);
  const [evaluationTake, setEvaluationTake] = useState<TakeView | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationView | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showShots, setShowShots] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [statusById, setStatusById] = useState<Record<string, CaptureStatus>>(() => Object.fromEntries(allShots.map((item) => [item.id, item.captureStatus])));
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const recordingFailedRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraAttemptRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxDuration = Math.min(30, Math.max(shot.targetDuration + 5, 10));

  const progress = useMemo(() => {
    const values = Object.values(statusById);
    return {
      captured: values.filter((status) => status === "CAPTURED").length,
      skipped: values.filter((status) => status === "SKIPPED").length,
    };
  }, [statusById]);

  const clearRecordingTimers = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (stopRef.current) clearTimeout(stopRef.current);
    tickRef.current = null;
    stopRef.current = null;
  }, []);

  const releaseCamera = useCallback(() => {
    cameraAttemptRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const discardClip = useCallback(() => {
    setClip((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  useEffect(() => () => {
    clearRecordingTimers();
    releaseCamera();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, [clearRecordingTimers, releaseCamera]);

  useEffect(() => {
    if (cameraActive && previewRef.current && streamRef.current) previewRef.current.srcObject = streamRef.current;
  }, [cameraActive, phase]);

  async function openCamera(mode = facingMode) {
    setError(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("当前页面无法使用摄像头。请使用 HTTPS 地址或在支持的环境中打开。");
      return;
    }
    if (!("MediaRecorder" in window)) {
      setError("当前浏览器暂不支持直接拍摄。请从手机相册选择视频。");
      return;
    }
    const attempt = cameraAttemptRef.current + 1;
    releaseCamera();
    cameraAttemptRef.current = attempt;
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: mode } }, audio: true });
      if (cameraAttemptRef.current !== attempt) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = mediaStream;
      setCameraActive(true);
      setPhase("CAMERA_READY");
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" || name === "SecurityError"
        ? "没有获得摄像头权限。你可以在浏览器设置中允许后重试。"
        : "无法打开摄像头，请检查摄像头是否正被其他应用使用。");
      releaseCamera();
    }
  }

  async function switchCamera() {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await openCamera(next);
  }

  function supportedMime() {
    return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || null;
  }

  async function startRecording() {
    const stream = streamRef.current;
    const mimeType = supportedMime();
    if (!stream || !mimeType) {
      setError("当前浏览器没有可用的录制格式，请从手机相册选择视频。");
      releaseCamera();
      setPhase("PREPARE");
      return;
    }
    const attempt = cameraAttemptRef.current;
    setError(null);
    for (const value of [3, 2, 1]) {
      if (attempt !== cameraAttemptRef.current || !streamRef.current) return;
      setCountdown(value);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setCountdown(null);
    if (attempt !== cameraAttemptRef.current || !streamRef.current) return;
    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recordingFailedRef.current = false;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => {
        recordingFailedRef.current = true;
        clearRecordingTimers();
        releaseCamera();
        setError("录制过程中出现问题，请重新拍摄或从相册选择视频。");
        setPhase("PREPARE");
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        if (recordingFailedRef.current) return;
        const duration = Math.max(0.1, (performance.now() - startedAtRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType });
        releaseCamera();
        if (!blob.size) {
          setError("没有录到有效视频，请重新拍摄。");
          setPhase("PREPARE");
          return;
        }
        discardClip();
        setClip({ blob, url: URL.createObjectURL(blob), fileName: `take.${extensionForMime(blob.type)}`, duration });
        setElapsed(duration);
        setPhase("REVIEW");
      };
      startedAtRef.current = performance.now();
      recorder.start(250);
      setElapsed(0);
      setPhase("RECORDING");
      tickRef.current = setInterval(() => setElapsed((performance.now() - startedAtRef.current) / 1000), 100);
      stopRef.current = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, maxDuration * 1000);
    } catch {
      releaseCamera();
      setError("当前浏览器无法开始录制，请从手机相册选择视频。");
      setPhase("PREPARE");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_TAKE_BYTES) {
      setError("视频过大，最大支持 100MB。");
      return;
    }
    releaseCamera();
    discardClip();
    setClip({ blob: file, url: URL.createObjectURL(file), fileName: file.name, duration: null });
    setPhase("REVIEW");
  }

  async function retake() {
    setSaved(false);
    setEvaluationTake(null);
    setEvaluation(null);
    discardClip();
    await openCamera();
  }

  function updateHistory(take: TakeView) {
    setTakeHistory((items) => [take, ...items.filter((item) => item.id !== take.id)]);
  }

  async function runEvaluation(take: TakeView, retry = false) {
    setEvaluationTake(take);
    setEvaluation(take.evaluation || { status: "PENDING", overallScore: null, framingScore: null, actionScore: null, movementScore: null, timingScore: null, visibilityScore: null, criticalIssues: [], mainIssue: null, advice: null, confidence: null, provider: null, model: null, evidence: null, error: null });
    setEvaluating(true);
    setError(null);
    try {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const response = await fetch(`/api/projects/${projectId}/take-evaluations/${take.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retry: retry && attempt === 0 }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "这次没有成功检查，请重新检查。");
        if (response.status === 202 || body.busy) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        const result = body.evaluation as EvaluationView;
        const updated = { ...take, evaluation: result, acceptanceStatus: result.status === "PASSED" ? "AI_PASSED" as const : take.acceptanceStatus };
        setEvaluation(result);
        setEvaluationTake(updated);
        updateHistory(updated);
        if (result.status === "PASSED") {
          setSelectedTake(updated);
          setStatusById((statuses) => ({ ...statuses, [shot.id]: "CAPTURED" }));
        }
        router.refresh();
        return;
      }
      throw new Error("镜头检查等待时间过长，请稍后重新检查。");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "这次没有成功检查，请重新检查。";
      setEvaluation((current) => ({
        ...(current || { overallScore: null, framingScore: null, actionScore: null, movementScore: null, timingScore: null, visibilityScore: null, criticalIssues: [], mainIssue: null, advice: null, confidence: null, provider: null, model: null, evidence: null }),
        status: "FAILED",
        error: message,
      }));
    } finally {
      setEvaluating(false);
    }
  }

  async function acceptCurrentTake() {
    if (!evaluationTake) return;
    setUploading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/take-evaluations/${evaluationTake.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "暂时无法使用这条素材。");
      const accepted = { ...evaluationTake, acceptanceStatus: "USER_ACCEPTED" as const, evaluation };
      setSelectedTake(accepted);
      updateHistory(accepted);
      setEvaluationTake(null);
      setEvaluation(null);
      setSaved(true);
      setStatusById((statuses) => ({ ...statuses, [shot.id]: "CAPTURED" }));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法使用这条素材。");
    } finally {
      setUploading(false);
    }
  }

  async function saveCurrentClip() {
    if (!clip || clip.duration && clip.duration > 30.05) {
      setError("单镜视频最长 30 秒，请缩短后重试。");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/takes/${shot.id}`, {
        method: "POST",
        headers: {
          "Content-Type": clip.blob.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(clip.fileName),
          "X-File-Size": String(clip.blob.size),
        },
        body: clip.blob,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "视频保存失败，请重试。");
      const uploadedTake = body.take as TakeView;
      setTakeCount((count) => count + 1);
      updateHistory(uploadedTake);
      setStatusById((statuses) => ({ ...statuses, [shot.id]: "CAPTURED" }));
      discardClip();
      setPhase("PREPARE");
      await runEvaluation(uploadedTake);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "视频保存失败，请重试。");
    } finally {
      setUploading(false);
    }
  }

  async function skipShot() {
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/takes/${shot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "暂时无法跳过这一镜。");
      setStatusById((statuses) => ({ ...statuses, [shot.id]: "SKIPPED" }));
      if (nextShotId) router.push(`/projects/${projectId}/shoot/${nextShotId}`);
      else router.push(`/projects/${projectId}/plan`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法跳过这一镜。");
    }
  }

  const nextHref = nextShotId ? `/projects/${projectId}/shoot/${nextShotId}` : `/projects/${projectId}/plan`;
  const orientationText = referenceVideo.orientation === "landscape" ? "参考视频是横屏，建议横着手机拍。"
    : referenceVideo.orientation === "portrait" ? "参考视频是竖屏，建议竖着手机拍。" : null;

  if (phase === "CAMERA_READY" || phase === "RECORDING") return <div className="fixed inset-0 z-50 flex min-h-svh flex-col bg-black text-white">
    <div className="relative flex-1 overflow-hidden">
      <video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-contain" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-4 pb-12 pt-[max(1rem,env(safe-area-inset-top))] text-sm">
        <button type="button" onClick={() => { clearRecordingTimers(); releaseCamera(); setPhase("PREPARE"); }} aria-label="退出取景"><X /></button>
        <strong>镜头 {shotIndex + 1} / {allShots.length}</strong>
        <span>目标约 {shot.targetDuration} 秒</span>
      </div>
      <p className="absolute inset-x-6 top-24 rounded-2xl bg-black/45 px-4 py-3 text-center text-sm leading-6 backdrop-blur-sm">{shot.actionInstruction}</p>
      {countdown !== null && <div className="absolute inset-0 grid place-items-center bg-black/20 text-8xl font-bold" aria-live="assertive">{countdown}</div>}
      {phase === "RECORDING" && <div className="absolute inset-x-0 bottom-28 text-center"><span className="rounded-full bg-black/60 px-4 py-2 font-mono text-lg"><span className="mr-2 inline-block size-2 rounded-full bg-red-500" />{formatTime(elapsed)}</span>{elapsed >= shot.targetDuration && <p className="mt-3 text-sm text-emerald-300">✓ 已达到建议时长</p>}</div>}
    </div>
    <div className="grid grid-cols-3 items-center bg-black px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
      <button type="button" className="flex flex-col items-center gap-1 text-xs" onClick={() => setShowReference(true)}><Images className="size-5" />参考</button>
      {phase === "RECORDING" ? <button type="button" onClick={stopRecording} className="mx-auto grid size-20 place-items-center rounded-full border-4 border-white bg-white/20" aria-label="停止录制"><span className="size-8 rounded-md bg-red-500" /></button>
        : <button type="button" disabled={countdown !== null} onClick={() => void startRecording()} className="mx-auto grid size-20 place-items-center rounded-full border-4 border-white bg-white/20 disabled:opacity-50" aria-label="开始录制"><span className="size-14 rounded-full bg-red-500" /></button>}
      <button type="button" disabled={phase === "RECORDING" || countdown !== null} className="flex flex-col items-center gap-1 text-xs disabled:opacity-40" onClick={() => void switchCamera()}><SwitchCamera className="size-5" />切换镜头</button>
    </div>
    {showReference && <ReferenceClip url={referenceVideo.url} start={shot.reference.startTime} end={shot.reference.endTime} onClose={() => setShowReference(false)} />}
  </div>;

  return <div className="mx-auto max-w-xl pb-8">
    <header className="mb-5">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm"><Link href={`/projects/${projectId}/plan`} className="inline-flex items-center gap-1 text-muted-foreground"><ArrowLeft className="size-4" />拍摄方案</Link><div className="flex items-center gap-4">{takeCount > 0 && <button type="button" onClick={() => setShowHistory(true)} className="inline-flex items-center gap-1 text-muted-foreground"><History className="size-4" />已拍 {takeCount} 条</button>}<button type="button" onClick={() => setShowShots(true)} className="inline-flex items-center gap-1 text-muted-foreground"><List className="size-4" />全部镜头</button></div></div>
      <div className="mb-2 flex items-end justify-between"><div><p className="text-sm text-muted-foreground">镜头 {shotIndex + 1} / {allShots.length}</p><h1 className="mt-1 text-2xl font-bold">准备拍这一镜</h1></div><p className="text-xs text-muted-foreground">已完成 {progress.captured} / {allShots.length}</p></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${allShots.length ? progress.captured / allShots.length * 100 : 0}%` }} /></div>
      {progress.skipped > 0 && <p className="mt-2 text-right text-xs text-amber-700">暂时跳过 {progress.skipped} 镜</p>}
    </header>

    {evaluationTake && evaluation ? <EvaluationPanel
      take={evaluationTake}
      evaluation={evaluation}
      evaluating={evaluating}
      debug={debugEvaluation}
      nextHref={nextHref}
      hasNext={Boolean(nextShotId)}
      busy={uploading}
      onRetake={() => void retake()}
      onAccept={() => void acceptCurrentTake()}
      onRetry={() => void runEvaluation(evaluationTake, true)}
    /> : saved && selectedTake ? <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-emerald-700"><Check className="size-5" />这一镜拍好了</div>
      <video src={selectedTake.videoUrl} controls playsInline className="aspect-[9/16] max-h-[58svh] w-full rounded-2xl bg-black object-contain" />
      <p className="mt-3 text-center text-xs text-muted-foreground">已保留 {takeCount} 条拍摄记录 · 当前使用最新一条</p>
      <Button asChild size="lg" className="mt-5 w-full"><Link href={nextHref}>{nextShotId ? "下一镜" : "返回拍摄方案"}<ArrowRight /></Link></Button>
    </section> : selectedTake && phase === "PREPARE" ? <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h1 className="text-xl font-bold">这一镜已经拍过</h1>
      <p className="mt-1 text-sm text-muted-foreground">已保留 {takeCount} 条，下面是当前使用的一条。</p>
      <video src={selectedTake.videoUrl} controls playsInline className="mt-4 aspect-[9/16] max-h-[58svh] w-full rounded-2xl bg-black object-contain" />
      <div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => void retake()}><RefreshCw />重新拍</Button><Button onClick={() => setSaved(true)}><Check />继续使用这条</Button></div>
    </section> : phase === "REVIEW" && clip ? <section>
      <p className="mb-3 text-center text-sm font-medium">刚才这一条</p>
      <video src={clip.url} autoPlay controls playsInline className="aspect-[9/16] max-h-[64svh] w-full rounded-3xl bg-black object-contain" onLoadedMetadata={(event) => {
        const duration = event.currentTarget.duration;
        if (Number.isFinite(duration)) setClip((current) => current ? { ...current, duration } : current);
      }} />
      <div className="my-4 flex justify-center gap-6 text-sm"><span>目标：{shot.targetDuration} 秒</span><span>实际：{clip.duration === null ? "读取中" : `${clip.duration.toFixed(1)} 秒`}</span></div>
      {clip.duration !== null && clip.duration > 30.05 && <p className="mb-3 rounded-xl bg-red-50 p-3 text-center text-sm text-red-700">单镜视频超过 30 秒，请重拍或选择更短的视频。</p>}
      <div className="grid grid-cols-2 gap-3"><Button variant="outline" disabled={uploading} onClick={() => void retake()}><RotateCcw />重拍</Button><Button disabled={uploading || clip.duration === null || clip.duration > 30.05} onClick={() => void saveCurrentClip()}><Check />{uploading ? "正在保存…" : "使用这条"}</Button></div>
    </section> : <section>
      <div className="relative overflow-hidden rounded-3xl bg-muted"><Image src={shot.reference.frameUrl} width={720} height={450} alt={`镜头 ${shot.order} 参考画面`} priority className="aspect-[16/10] w-full object-cover" /><button type="button" onClick={() => setShowReference(true)} className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm text-white"><Video className="size-4" />看参考片段</button></div>
      {orientationText && <p className="mt-3 text-center text-xs text-muted-foreground">{orientationText}</p>}
      <div className="mt-6 space-y-5 rounded-3xl bg-white p-5 shadow-sm">
        <Instruction title="这一镜的作用" text={shot.purpose} />
        <Instruction title="你要做什么" text={shot.actionInstruction} />
        <Instruction title="手机怎么拍" text={shot.cameraInstruction} />
        {shot.dialogue && <Instruction title="台词" text={shot.dialogue} />}
      </div>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</p>}
      <Button size="lg" className="mt-5 w-full" onClick={() => void openCamera()}><Camera />准备拍摄</Button>
      <button type="button" className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-medium" onClick={() => fileInputRef.current?.click()}><Images className="size-4" />从相册选择视频</button>
      <input ref={fileInputRef} className="sr-only" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" onChange={(event) => void chooseFile(event)} />
      <button type="button" onClick={() => void skipShot()} className="mt-4 w-full py-2 text-sm text-muted-foreground underline underline-offset-4">暂时跳过</button>
    </section>}

    {error && (phase === "REVIEW" || saved) && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</p>}
    {showReference && <ReferenceClip url={referenceVideo.url} start={shot.reference.startTime} end={shot.reference.endTime} onClose={() => setShowReference(false)} />}
    {showShots && <ShotList projectId={projectId} shots={allShots} currentId={shot.id} statuses={statusById} onClose={() => setShowShots(false)} />}
    {showHistory && <TakeHistory takes={takeHistory} selectedTakeId={selectedTake?.id || null} onClose={() => setShowHistory(false)} />}
  </div>;
}

function Instruction({ title, text }: { title: string; text: string }) {
  return <div><h2 className="mb-1 text-xs font-medium text-muted-foreground">{title}</h2><p className="whitespace-pre-line text-[15px] leading-7">{text}</p></div>;
}

function EvaluationPanel({ take, evaluation, evaluating, debug, nextHref, hasNext, busy, onRetake, onAccept, onRetry }: {
  take: TakeView;
  evaluation: EvaluationView;
  evaluating: boolean;
  debug: boolean;
  nextHref: string;
  hasNext: boolean;
  busy: boolean;
  onRetake: () => void;
  onAccept: () => void;
  onRetry: () => void;
}) {
  const loading = evaluating || evaluation.status === "PENDING" || evaluation.status === "EVALUATING";
  const failed = evaluation.status === "FAILED";
  const lowConfidence = !failed && evaluation.confidence !== null && evaluation.confidence < 0.55;
  return <section className="rounded-3xl bg-white p-5 shadow-sm">
    <video src={take.videoUrl} autoPlay loop={loading} muted={loading} controls={!loading} playsInline className="aspect-[9/16] max-h-[58svh] w-full rounded-2xl bg-black object-contain" />
    {loading ? <div className="py-7 text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-primary" /><h2 className="mt-3 text-xl font-bold">正在看刚才这一条…</h2><p className="mt-2 text-sm text-muted-foreground">视频已经保存，检查失败也不会丢失。</p></div>
      : failed ? <div className="pt-5 text-center"><AlertTriangle className="mx-auto size-7 text-amber-600" /><h2 className="mt-3 text-xl font-bold">这次没有成功检查</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{evaluation.error || "AI 服务暂时不可用。"}</p><div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" disabled={busy} onClick={onAccept}>先使用这条</Button><Button disabled={busy} onClick={onRetry}>重新检查</Button></div></div>
      : lowConfidence ? <div className="pt-5"><h2 className="text-center text-xl font-bold">AI 不太确定这条是否完成要求</h2>{evaluation.mainIssue && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{evaluation.mainIssue}</p>}<div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" onClick={onRetake}>重新拍</Button><Button onClick={onAccept}>继续使用</Button></div><Button variant="ghost" className="mt-2 w-full" onClick={onRetry}>重新检查</Button></div>
      : evaluation.status === "PASSED" ? <div className="pt-5 text-center"><div className="text-xl font-bold text-emerald-700">✓ 这条可以用</div><p className="mt-2 text-sm text-muted-foreground">动作和画面都完成了。</p><Button asChild size="lg" className="mt-5 w-full"><Link href={nextHref}>{hasNext ? "下一镜" : "返回拍摄方案"}<ArrowRight /></Link></Button><Button variant="ghost" className="mt-2 w-full" onClick={onRetake}>再拍一条</Button></div>
      : <div className="pt-5"><h2 className="text-center text-xl font-bold">建议再拍一条</h2>{evaluation.mainIssue && <div className="mt-5"><p className="text-xs font-medium text-muted-foreground">最需要修改</p><p className="mt-1 text-base font-semibold">{evaluation.mainIssue}</p></div>}{evaluation.advice && <div className="mt-4 rounded-2xl bg-amber-50 p-4"><p className="text-xs font-medium text-amber-800">重拍建议</p><p className="mt-1 text-sm leading-6 text-amber-950">{evaluation.advice}</p></div>}<Button size="lg" className="mt-5 w-full" onClick={onRetake}>按建议重拍</Button><Button variant="ghost" className="mt-2 w-full" disabled={busy} onClick={onAccept}>仍然使用这条</Button></div>}
    {debug && !loading && <div className="mt-5 rounded-2xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100"><div>overall: {evaluation.overallScore ?? "-"}</div><div>framing: {evaluation.framingScore ?? "-"}</div><div>action: {evaluation.actionScore ?? "-"}</div><div>movement: {evaluation.movementScore ?? "-"}</div><div>timing: {evaluation.timingScore ?? "-"}</div><div>visibility: {evaluation.visibilityScore ?? "-"}</div><div>criticalIssues: {evaluation.criticalIssues.join(", ") || "[]"}</div><div>confidence: {evaluation.confidence ?? "-"}</div><div>provider: {evaluation.provider || "-"}</div><div>model: {evaluation.model || "-"}</div><div>evidence: {evaluation.evidence || "-"}</div></div>}
  </section>;
}

function TakeHistory({ takes, selectedTakeId, onClose }: { takes: TakeView[]; selectedTakeId: string | null; onClose: () => void }) {
  const label = (take: TakeView) => take.evaluation?.status === "PASSED" ? "AI：通过"
    : take.evaluation?.status === "NEEDS_RETAKE" ? "AI：建议重拍"
    : take.evaluation?.status === "FAILED" ? "AI：检查失败"
    : take.evaluation?.status === "EVALUATING" ? "AI：检查中" : "AI：待检查";
  return <div className="fixed inset-0 z-[60] bg-black/45" role="dialog" aria-modal="true" aria-label="拍摄历史"><div className="absolute inset-x-0 bottom-0 max-h-[88svh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"><div className="mb-4 flex items-center justify-between"><div><strong>已拍 {takes.length} 条</strong><p className="mt-1 text-xs text-muted-foreground">每次拍摄都会保留</p></div><button type="button" onClick={onClose} aria-label="关闭拍摄历史"><X /></button></div><div className="space-y-5">{takes.map((take) => <article key={take.id} className="rounded-2xl border border-border p-3"><video src={take.videoUrl} controls playsInline preload="metadata" className="aspect-[9/16] max-h-72 w-full rounded-xl bg-black object-contain" /><div className="mt-3 flex items-center justify-between gap-2 text-sm"><span>{take.duration.toFixed(1)} 秒 · {label(take)}</span>{selectedTakeId === take.id && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">当前使用</span>}</div>{take.acceptanceStatus === "USER_ACCEPTED" && <p className="mt-2 text-xs text-muted-foreground">用户已决定采用</p>}</article>)}</div></div></div>;
}

function ReferenceClip({ url, start, end, onClose }: { url: string; start: number; end: number; onClose: () => void }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="参考片段">
    <div className="w-full max-w-lg"><div className="mb-3 flex items-center justify-between text-white"><strong>参考片段</strong><button type="button" onClick={onClose} aria-label="关闭参考片段"><X /></button></div><video src={url} autoPlay controls playsInline className="max-h-[75svh] w-full rounded-2xl bg-black" onLoadedMetadata={(event) => { event.currentTarget.currentTime = start; void event.currentTarget.play().catch(() => {}); }} onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= end) { event.currentTarget.currentTime = start; void event.currentTarget.play().catch(() => {}); } }} /></div>
  </div>;
}

function ShotList({ projectId, shots, currentId, statuses, onClose }: { projectId: string; shots: { id: string; order: number }[]; currentId: string; statuses: Record<string, CaptureStatus>; onClose: () => void }) {
  return <div className="fixed inset-0 z-[60] bg-black/40" role="dialog" aria-modal="true" aria-label="全部镜头"><div className="absolute inset-x-0 bottom-0 max-h-[80svh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"><div className="mb-4 flex items-center justify-between"><strong>全部镜头</strong><button type="button" onClick={onClose} aria-label="关闭镜头列表"><X /></button></div><div className="grid grid-cols-4 gap-2">{shots.map((item) => {
    const status = statuses[item.id];
    const mark = item.id === currentId ? "→" : status === "CAPTURED" ? "✓" : status === "SKIPPED" ? "稍后" : "○";
    return <Link key={item.id} href={`/projects/${projectId}/shoot/${item.id}`} className={`flex h-12 items-center justify-center gap-1 rounded-xl border text-sm ${item.id === currentId ? "border-primary bg-primary text-white" : status === "CAPTURED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border"}`}><span>{mark}</span><span>{item.order}</span></Link>;
  })}</div></div></div>;
}
