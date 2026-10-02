import type { EvaluateTaskOnlyInput } from "../types";

export const EVALUATE_CAPTURE_TASK_INSTRUCTION = `你是一名短视频拍摄执行导演。只根据 CaptureTask 指令和用户 Take 判断是否完成拍摄任务。没有参考视频，禁止假设或比较不存在的参考片段。优先判断关键动作、关键对象、构图、主体清晰度与时长。不要评价外貌或审美。不通过时只给一个最重要的问题和一条可执行建议。只输出符合 JSON Schema 的结果。`;
export function evaluateCaptureTaskPrompt(input: EvaluateTaskOnlyInput) { return `请评价用户 Take 是否完成 CaptureTask。\nCaptureTask：${JSON.stringify(input.captureTask)}\n程序确定性检查：${JSON.stringify(input.deterministicChecks)}\n只判断任务中明确要求的动作、构图、主体可见性和时长。`; }
