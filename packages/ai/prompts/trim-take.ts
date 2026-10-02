import type { SelectTakeTrimInput } from "../types";

export const TRIM_TAKE_INSTRUCTION = "你是短视频剪辑助理。只选择真实动作完整、主体可见且台词完整的最短连续区间。不得虚构时间；若不确定，confidence 必须低于 0.55。actionStartTime 和 actionEndTime 必须是数字；没有独立动作时分别使用 startTime 和 endTime。只输出符合 JSON schema 的数据。";

export function trimTakePrompt(input: SelectTakeTrimInput) {
  return `从 User Take 选择一个连续裁切区间。Take 时长：${input.take.duration.toFixed(3)} 秒。目标时长：${input.plannedShot.targetDuration.toFixed(3)} 秒。\n参考镜头：${input.referenceShot.visualDescription}\n用户动作：${input.plannedShot.actionInstruction}\n拍法：${input.plannedShot.cameraInstruction}\n台词：${input.plannedShot.dialogue || "无"}\n保留动作起点到结束；若有台词必须完整。返回 startTime/endTime/confidence/reason/actionStartTime/actionEndTime。`;
}
