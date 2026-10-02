import type { AnalyzeReferenceInput, EvaluateTakeInput, EvaluateTaskOnlyInput, GenerateShootingPlanInput, PlannedShotPlan, RegeneratePlannedShotInput, ShotPlan, TakeEvaluation } from "../types";
import type { VideoAIProvider } from "../video-ai-provider";

export class MockVideoAIProvider implements VideoAIProvider {
  constructor(private readonly evaluationResult: "passed" | "rejected" = "passed") {}

  async analyzeReferenceVideo(input: AnalyzeReferenceInput): Promise<ShotPlan[]> {
    const scenes = [
      ["把杯子轻轻放在窗边的桌上，手自然离开画面。", "手机放在桌面斜上方，让杯子和窗边的光都出现在画面里。", null],
      ["舀一勺咖啡粉，慢慢倒入杯子。", "手机靠近杯口，固定在侧上方，拍清楚咖啡粉落下的过程。", null],
      ["缓缓倒入热水，让水流保持在画面中间。", "手机放在杯子侧面，与杯口差不多高，保持不动。", null],
      ["握住杯柄，轻轻搅拌两圈，再停下来。", "手机放在杯子正上方，留一点桌面在画面四周。", null],
      ["双手捧起杯子，在窗边停留片刻。", "把手机放稳，退后一步，让上半身和窗户一起入镜。", "给自己一点慢下来的时间。"],
    ] as const;

    return scenes.map(([actionInstruction, cameraInstruction, dialogue], index) => ({
      order: index + 1,
      startTime: index * input.duration / 5,
      endTime: (index + 1) * input.duration / 5,
      targetDuration: input.duration / 5,
      shotSize: index === 4 ? "中景" : "近景",
      cameraMovement: "固定",
      visualDescription: `咖啡示例画面：${actionInstruction}`,
      actionInstruction,
      cameraInstruction,
      dialogue,
    }));
  }

  async generateShootingPlan(input: GenerateShootingPlanInput): Promise<PlannedShotPlan[]> {
    const person = input.brief.talentMode === "SELF" ? "你" : input.brief.talentMode === "OTHER_PERSON" ? "出镜的人" : "商品";
    return input.referenceShots.map((shot, index) => ({
      referenceShotId: shot.id,
      order: shot.order,
      purpose: index === 0 ? "快速吸引注意力" : index === input.referenceShots.length - 1 ? "完成内容收尾" : "展示内容细节",
      actionInstruction: `${person}在${input.brief.location || "容易拍摄的地方"}展示${input.brief.subject}，动作保持自然。`,
      cameraInstruction: shot.cameraMovement === "固定" || input.brief.talentMode === "SELF" ? "把手机放稳，保持主体完整入镜。" : "用手机缓慢跟随主体移动，避免突然晃动。",
      dialogue: shot.dialogue ? `给大家看看${input.brief.subject}。` : null,
      targetDuration: shot.targetDuration,
      difficulty: shot.cameraMovement === "固定" ? "EASY" : "MEDIUM",
      notes: null,
    }));
  }

  async regeneratePlannedShot(input: RegeneratePlannedShotInput): Promise<PlannedShotPlan> {
    const [shot] = await this.generateShootingPlan(input);
    return { ...shot, actionInstruction: `${shot.actionInstruction} 换一个角度重新完成这一步。`, notes: input.reason };
  }

  async evaluateTake(input: EvaluateTakeInput): Promise<TakeEvaluation> {
    if (this.evaluationResult === "rejected") {
      return {
        passed: false,
        overallScore: 52,
        dimensions: { framing: 76, action: 58, movement: 42, timing: 70, visibility: 80 },
        criticalIssues: [],
        mainIssue: "手机晃动影响了核心动作的辨认。",
        advice: "把手机固定后，完整重复一次当前动作。",
        confidence: 0.9,
        evidence: "画面在动作进行时持续明显晃动。",
        issueStartTime: 0.5,
        issueEndTime: Math.min(2, input.take.duration),
      };
    }
    return {
      passed: true,
      overallScore: 86,
      dimensions: { framing: 86, action: 90, movement: 82, timing: 84, visibility: 88 },
      criticalIssues: [],
      mainIssue: null,
      advice: "这条可以使用。",
      confidence: 0.92,
      evidence: "核心动作和主体都清楚出现在画面中。",
      issueStartTime: null,
      issueEndTime: null,
    };
  }
  async evaluateTaskOnly(input: EvaluateTaskOnlyInput): Promise<TakeEvaluation> { return this.evaluateTake({ referenceShot: { visualDescription: input.captureTask.purpose, shotSize: "未指定", cameraMovement: "未指定", targetDuration: input.captureTask.targetDuration }, plannedShot: { ...input.captureTask, dialogue: null }, take: input.take, referenceClip: { localFilePath: input.take.localFilePath, mimeType: "video/mp4" }, deterministicChecks: { ...input.deterministicChecks, referenceOrientation: "UNKNOWN", orientationMatch: null } }); }
}
