import { z } from "zod";
import { WorkflowError } from "../../lib/errors";

export const plannedShotSchema = z.object({
  referenceShotId: z.string().trim().min(1),
  order: z.number().int().positive(),
  purpose: z.string().trim().min(1).max(300),
  actionInstruction: z.string().trim().min(1).max(2000),
  cameraInstruction: z.string().trim().min(1).max(2000),
  dialogue: z.string().trim().max(1000).nullable(),
  targetDuration: z.number().positive(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  notes: z.string().trim().max(1000).nullable(),
}).strict();

export const plannedShotsSchema = z.array(plannedShotSchema).min(1).max(200);
export const plannedShotsJsonSchema = z.toJSONSchema(plannedShotsSchema, { target: "draft-7" });

export type ReferenceShotForPlan = {
  id: string;
  order: number;
  targetDuration: number;
};

export function validatePlannedShots(value: unknown, references: ReferenceShotForPlan[], constraints: { talentMode?: "SELF" | "OTHER_PERSON" | "PRODUCT_ONLY" } = {}) {
  const result = plannedShotsSchema.safeParse(value);
  if (!result.success) throw new WorkflowError("INVALID_PLAN_DATA", "AI 返回的拍摄方案不完整，请重新生成。", 422, { cause: result.error });
  if (result.data.length !== references.length) throw new WorkflowError("INVALID_PLAN_COUNT", "AI 返回的镜头数量不正确，请重新生成。", 422);
  result.data.forEach((shot, index) => {
    const reference = references[index];
    const durationTolerance = Math.max(0.5, reference.targetDuration * 0.35);
    if (shot.order !== reference.order || shot.referenceShotId !== reference.id
      || Math.abs(shot.targetDuration - reference.targetDuration) > durationTolerance) {
      throw new WorkflowError("INVALID_PLAN_STRUCTURE", "AI 没有保持参考视频的镜头结构，请重新生成。", 422);
    }
    if (shot.dialogue && !/[。！？!?…][」』”"）)]?$/.test(shot.dialogue)) {
      throw new WorkflowError("INCOMPLETE_DIALOGUE", "AI 返回了未说完整的台词，请重新生成。", 422);
    }
    if (constraints.talentMode === "SELF" && /(朋友|摄影师|同伴|另一人|其他人|他人|别人|助手|助理|店员|家人|搭档|拍摄者|请人|帮.{0,4}(拿|拍|跟拍|移动))/u.test(shot.cameraInstruction)) {
      throw new WorkflowError("SELF_CAPTURE_CONFLICT", "AI 返回了需要他人协助的拍法，请重新生成。", 422);
    }
  });
  return result.data;
}

export function parsePlannedShots(text: string, references: ReferenceShotForPlan[]) {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (error) { throw new WorkflowError("AI_PARSE_FAILED", "AI 返回的数据无法解析，请重新生成。", 422, { cause: error }); }
  return validatePlannedShots(value, references);
}
