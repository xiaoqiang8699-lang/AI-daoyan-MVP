import type { AnalyzeReferenceInput, EvaluateTakeInput, GenerateShootingPlanInput, PlannedShotPlan, RegeneratePlannedShotInput, SelectTakeTrimInput, ShotPlan, TakeEvaluation, TakeTrim } from "./types";

export interface VideoAIProvider {
  analyzeReferenceVideo(input: AnalyzeReferenceInput): Promise<ShotPlan[]>;
  generateShootingPlan(input: GenerateShootingPlanInput): Promise<PlannedShotPlan[]>;
  regeneratePlannedShot(input: RegeneratePlannedShotInput): Promise<PlannedShotPlan>;
  evaluateTake(input: EvaluateTakeInput): Promise<TakeEvaluation>;
  selectTakeTrim?(input: SelectTakeTrimInput): Promise<TakeTrim>;
}
