export type FinalVideoQAResult = { passed: boolean; criticalIssues: string[]; mainIssue: string | null; advice: string | null; confidence: number };
export interface FinalQAProvider { evaluateFinalVideo(input: { localFilePath: string; mimeType: "video/mp4"; duration: number; subtitleEnabled: boolean }): Promise<FinalVideoQAResult>; }

export class MockFinalQAProvider implements FinalQAProvider {
  async evaluateFinalVideo(): Promise<FinalVideoQAResult> { return { passed: true, criticalIssues: [], mainIssue: null, advice: null, confidence: 0.9 }; }
}
