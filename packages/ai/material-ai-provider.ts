export type MaterialAnalysisResult = { summary: string; scene: string | null; activity: string | null; objects: string[]; topics: string[]; speechSummary: string | null; visualQuality: "GOOD" | "USABLE" | "POOR"; storyPotential: number; confidence: number; rawResult?: unknown };
export type StructuredOutputMode = "native_json_schema" | "prompt_json";
export type MaterialAnalysisInput = { assetId: string; localFilePath: string; mimeType: string; type: "VIDEO" | "IMAGE"; duration: number | null };
export type StoryEventPlan = { title: string; summary: string; assetIds: string[]; confidence: number; reason: string };
export type ContentThreadPlan = { title: string; summary: string; assetIds: string[]; confidence: number; reason: string };
export type CapturedAtReliability = "RELIABLE" | "WEAK" | "NONE";
export type OpportunityPlan = { title: string; contentType: "PRODUCT" | "DAILY_VLOG" | "STORY" | "KNOWLEDGE" | "BEHIND_THE_SCENES" | "OTHER"; angle: string; summary: string; hook: string; targetDuration: number; reason: string; assetIds: string[]; missing: Array<{ purpose: string; actionInstruction: string; cameraInstruction: string; targetDuration: number; reason: string }> };
export interface MaterialUnderstandingProvider {
  readonly structuredOutputMode: StructuredOutputMode;
  analyzeMaterial(input: MaterialAnalysisInput): Promise<MaterialAnalysisResult>;
  clusterEvents(input: { assets: Array<{ assetId: string; capturedAt: Date | null; capturedAtSource: "MEDIA_METADATA" | "USER_UPLOAD" | "UNKNOWN"; capturedAtReliability: CapturedAtReliability; analysis: MaterialAnalysisResult }> }): Promise<{ contentThreads: ContentThreadPlan[]; events: StoryEventPlan[]; unassignedAssetIds: string[] }>;
  discoverOpportunities(input: { contentThreads: ContentThreadPlan[]; events: StoryEventPlan[]; assets: Array<{ assetId: string; analysis: MaterialAnalysisResult }>; userGoal: string }): Promise<OpportunityPlan[]>;
}
