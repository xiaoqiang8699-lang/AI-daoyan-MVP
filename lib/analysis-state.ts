export interface AnalysisState {
  status: string;
  error: string | null;
  shotCount: number;
  provider: string | null;
}
