import type { z } from "zod";
import type { shotPlanSchema } from "./shot-schema";
import type { plannedShotSchema } from "./planned-shot-schema";

export interface AnalyzeReferenceInput {
  fileUrl: string;
  duration: number;
  localFilePath?: string;
  mimeType?: string;
}

export type ShotPlan = z.infer<typeof shotPlanSchema>;

export type PlannedShotPlan = z.infer<typeof plannedShotSchema>;

export type ShootingBriefInput = {
  subject: string;
  talentMode: "SELF" | "OTHER_PERSON" | "PRODUCT_ONLY";
  location: string;
  goal: string;
  additionalContext: string | null;
};

export type ReferenceShotInput = {
  id: string;
  order: number;
  startTime: number;
  endTime: number;
  targetDuration: number;
  shotSize: string;
  cameraMovement: string;
  visualDescription: string;
  dialogue: string | null;
};

export interface GenerateShootingPlanInput {
  project: { id: string; name: string };
  brief: ShootingBriefInput;
  referenceVideo: { duration: number; width: number | null; height: number | null; fps: number | null; codec: string | null };
  referenceShots: ReferenceShotInput[];
}

export interface RegeneratePlannedShotInput extends GenerateShootingPlanInput {
  currentShot: PlannedShotPlan;
  reason: string | null;
}

export const criticalIssueValues = [
  "SUBJECT_MISSING",
  "KEY_ACTION_MISSING",
  "PRODUCT_NOT_VISIBLE",
  "SEVERELY_OUT_OF_FRAME",
  "UNUSABLE_VISIBILITY",
  "WRONG_SHOT_CONTENT",
] as const;

export type CriticalIssue = typeof criticalIssueValues[number];
export type EvaluationDimensions = {
  framing: number;
  action: number;
  movement: number;
  timing: number;
  visibility: number;
};

export type DeterministicTakeChecks = {
  fileValid: boolean;
  takeDuration: number;
  targetDuration: number;
  durationRatio: number;
  takeOrientation: "LANDSCAPE" | "PORTRAIT" | "SQUARE";
  referenceOrientation: "LANDSCAPE" | "PORTRAIT" | "SQUARE" | "UNKNOWN";
  orientationMatch: boolean | null;
  warnings: Array<"DURATION_OUT_OF_RANGE" | "ORIENTATION_MISMATCH">;
};

export interface EvaluateTakeInput {
  referenceShot: {
    visualDescription: string;
    shotSize: string;
    cameraMovement: string;
    targetDuration: number;
  };
  plannedShot: {
    purpose: string;
    actionInstruction: string;
    cameraInstruction: string;
    dialogue: string | null;
    targetDuration: number;
  };
  take: {
    videoUrl: string;
    localFilePath: string;
    mimeType: string;
    duration: number;
    width: number;
    height: number;
  };
  referenceClip: {
    localFilePath: string;
    mimeType: "video/mp4";
  };
  deterministicChecks: DeterministicTakeChecks;
}
export interface EvaluateTaskOnlyInput {
  captureTask: { purpose: string; actionInstruction: string; cameraInstruction: string; targetDuration: number };
  take: { videoUrl: string; localFilePath: string; mimeType: string; duration: number; width: number; height: number };
  deterministicChecks: Omit<DeterministicTakeChecks, "referenceOrientation" | "orientationMatch">;
}

export interface TakeEvaluation {
  passed: boolean;
  overallScore: number;
  dimensions: EvaluationDimensions;
  criticalIssues: CriticalIssue[];
  mainIssue: string | null;
  /** 只返回一条最重要的建议。 */
  advice: string;
  confidence: number;
  evidence: string | null;
  issueStartTime: number | null;
  issueEndTime: number | null;
  /** Provider transport timings and billing units when the provider exposes them. */
  providerMetadata?: {
    uploadMs?: number;
    evaluationMs?: number;
    creditsConsumed?: number;
    uploads?: Array<{
      role: "REFERENCE_CLIP" | "USER_TAKE";
      fileId: string | null;
      url: string;
      uploadedAt: string;
      expiresAt: string | null;
      deletionStatus: "NOT_SUPPORTED";
    }>;
  };
}

export interface SelectTakeTrimInput {
  referenceShot: { visualDescription: string; targetDuration: number };
  plannedShot: { actionInstruction: string; cameraInstruction: string; dialogue: string | null; targetDuration: number };
  take: { localFilePath: string; mimeType: string; duration: number };
  referenceClip: { localFilePath: string; mimeType: "video/mp4" };
}

export type TakeTrim = { startTime: number; endTime: number; confidence: number; reason: string; actionStartTime: number | null; actionEndTime: number | null };
