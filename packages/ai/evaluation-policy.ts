import type { DeterministicTakeChecks, TakeEvaluation } from "./types";

export const EVALUATION_POLICY = {
  durationRatio: { min: 0.6, max: 1.8 },
  minimumScores: { action: 65, framing: 60, visibility: 60 },
  lowConfidence: 0.55,
} as const;

export function applyEvaluationPolicy(result: TakeEvaluation) {
  const passed = result.passed
    && result.criticalIssues.length === 0
    && result.dimensions.action >= EVALUATION_POLICY.minimumScores.action
    && result.dimensions.framing >= EVALUATION_POLICY.minimumScores.framing
    && result.dimensions.visibility >= EVALUATION_POLICY.minimumScores.visibility;
  return { ...result, passed };
}

function orientation(width: number, height: number) {
  return width === height ? "SQUARE" as const : width > height ? "LANDSCAPE" as const : "PORTRAIT" as const;
}

export function deterministicTakeChecks(input: {
  take: { duration: number; width: number; height: number };
  targetDuration: number;
  referenceVideo: { width: number | null; height: number | null };
}): DeterministicTakeChecks {
  const durationRatio = input.take.duration / input.targetDuration;
  const takeOrientation = orientation(input.take.width, input.take.height);
  const referenceOrientation = input.referenceVideo.width && input.referenceVideo.height
    ? orientation(input.referenceVideo.width, input.referenceVideo.height) : "UNKNOWN";
  const orientationMatch = referenceOrientation === "UNKNOWN" ? null : takeOrientation === referenceOrientation;
  const warnings: DeterministicTakeChecks["warnings"] = [];
  if (durationRatio < EVALUATION_POLICY.durationRatio.min || durationRatio > EVALUATION_POLICY.durationRatio.max) warnings.push("DURATION_OUT_OF_RANGE");
  if (orientationMatch === false) warnings.push("ORIENTATION_MISMATCH");
  return {
    fileValid: input.take.duration > 0 && input.take.width > 0 && input.take.height > 0,
    takeDuration: input.take.duration,
    targetDuration: input.targetDuration,
    durationRatio,
    takeOrientation,
    referenceOrientation,
    orientationMatch,
    warnings,
  };
}
