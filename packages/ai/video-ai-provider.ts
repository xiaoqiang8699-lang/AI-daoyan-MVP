import type { AnalyzeReferenceInput, EvaluateTakeInput, EvaluateTaskOnlyInput, GenerateShootingPlanInput, PlannedShotPlan, RegeneratePlannedShotInput, SelectTakeTrimInput, ShotPlan, TakeEvaluation, TakeTrim } from "./types";

export interface VideoAIProvider {
  analyzeReferenceVideo(input: AnalyzeReferenceInput): Promise<ShotPlan[]>;
  generateShootingPlan(input: GenerateShootingPlanInput): Promise<PlannedShotPlan[]>;
  regeneratePlannedShot(input: RegeneratePlannedShotInput): Promise<PlannedShotPlan>;
  evaluateTake(input: EvaluateTakeInput): Promise<TakeEvaluation>;
  evaluateTaskOnly?(input: EvaluateTaskOnlyInput): Promise<TakeEvaluation>;
  selectTakeTrim?(input: SelectTakeTrimInput): Promise<TakeTrim>;
}
