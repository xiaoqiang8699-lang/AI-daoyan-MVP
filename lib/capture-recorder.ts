export type RecorderState = "inactive" | "recording" | "paused";
export type RecorderLike = { state: RecorderState; stop: () => void; requestData?: () => void };

export function stopMediaRecorder(recorder: RecorderLike | null, stopping: { current: boolean }) {
  if (!recorder || stopping.current || (recorder.state !== "recording" && recorder.state !== "paused")) return false;
  stopping.current = true;
  if (recorder.state === "recording") {
    try { recorder.requestData?.(); } catch { /* Safari may only emit its final data from onstop. */ }
  }
  recorder.stop();
  return true;
}

export function capturePhaseAfterStop() { return "REVIEW" as const; }
