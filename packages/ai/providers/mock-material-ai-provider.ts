import type { MaterialUnderstandingProvider } from "../material-ai-provider";
export class MockMaterialAIProvider implements MaterialUnderstandingProvider {
  readonly structuredOutputMode = "prompt_json" as const;
  async analyzeMaterial(input: Parameters<MaterialUnderstandingProvider["analyzeMaterial"]>[0]) { return { summary: input.type === "VIDEO" ? "测试视频素材。" : "测试图片素材。", scene: "测试场景", activity: null, objects: [], topics: [], speechSummary: null, visualQuality: "USABLE" as const, storyPotential: 20, confidence: 0.5 }; }
  async clusterEvents() { return { events: [], unassignedAssetIds: [] }; }
  async discoverOpportunities() { return []; }
}
