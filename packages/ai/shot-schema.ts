import { z } from "zod";
import { WorkflowError } from "../../lib/errors";

export const shotPlanSchema = z.object({
  order: z.number().int().positive(),
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  targetDuration: z.number().positive(),
  shotSize: z.string().trim().min(1).max(100),
  cameraMovement: z.string().trim().min(1).max(200),
  visualDescription: z.string().trim().min(1).max(2000),
  actionInstruction: z.string().trim().min(1).max(2000),
  cameraInstruction: z.string().trim().min(1).max(2000),
  dialogue: z.string().trim().max(4000).nullable().optional(),
}).strict();

export const shotPlansSchema = z.array(shotPlanSchema).min(1).max(200);
export const shotPlansJsonSchema = z.toJSONSchema(shotPlansSchema, { target: "draft-7" });

export function validateShotPlans(value: unknown, duration: number) {
  if (Array.isArray(value) && value.length === 0) throw new WorkflowError("EMPTY_SHOTS", "没有识别出有效镜头，请重新分析。", 422);
  const result = shotPlansSchema.safeParse(value);
  if (!result.success) throw new WorkflowError("INVALID_AI_DATA", "AI 返回的拍摄步骤不完整，请重新分析。", 422, { cause: result.error });
  const shots = result.data;
  const tolerance = 0.25;
  if (!Number.isFinite(duration) || duration <= 0) throw new WorkflowError("INVALID_DURATION", "无法读取视频时长。", 422);
  shots.forEach((shot, index) => {
    const span = shot.endTime - shot.startTime;
    const previous = shots[index - 1];
    if (shot.order !== index + 1 || span <= 0 || shot.startTime >= duration || shot.endTime > duration + tolerance
      || Math.abs(shot.targetDuration - span) > Math.max(tolerance, span * 0.1)
      || (previous && (shot.startTime < previous.startTime || shot.startTime < previous.endTime - tolerance))) {
      throw new WorkflowError("INVALID_TIMELINE", "AI 返回的镜头时间顺序有误，请重新分析。", 422);
    }
  });
  return shots;
}

export function parseShotPlans(text: string, duration: number) {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) { throw new WorkflowError("AI_PARSE_FAILED", "AI 返回的数据无法解析，请重新分析。", 422, { cause: error }); }
  return validateShotPlans(value, duration);
}
