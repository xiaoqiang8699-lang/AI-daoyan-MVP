import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePlannedShots } from "../packages/ai/planned-shot-schema";

const references = [
  { id: "reference-1", order: 1, targetDuration: 2 },
  { id: "reference-2", order: 2, targetDuration: 3 },
];

const planned = (referenceShotId: string, order: number, targetDuration: number) => ({
  referenceShotId,
  order,
  purpose: "展示商品细节",
  actionInstruction: "把衣服举到胸口位置。",
  cameraInstruction: "把手机放稳，让衣服完整进入画面。",
  dialogue: null,
  targetDuration,
  difficulty: "EASY" as const,
  notes: null,
});

test("完整方案保持参考镜头数量、顺序和关联", () => {
  const result = validatePlannedShots([planned("reference-1", 1, 2), planned("reference-2", 2, 3)], references);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((shot) => shot.referenceShotId), references.map((shot) => shot.id));
});

test("缺字段、错误顺序、错误关联和错误数量会失败", () => {
  assert.throws(() => validatePlannedShots([{ ...planned("reference-1", 1, 2), purpose: undefined }], references));
  assert.throws(() => validatePlannedShots([planned("reference-2", 1, 2), planned("reference-1", 2, 3)], references));
  assert.throws(() => validatePlannedShots([planned("reference-1", 2, 2), planned("reference-2", 1, 3)], references));
  assert.throws(() => validatePlannedShots([planned("reference-1", 1, 2)], references));
});

test("拒绝被截断的台词和 SELF 条件下依赖他人拍摄", () => {
  assert.throws(() => validatePlannedShots([
    { ...planned("reference-1", 1, 2), dialogue: "不管是上班通勤，" },
    planned("reference-2", 2, 3),
  ], references), /未说完整/);
  assert.throws(() => validatePlannedShots([
    { ...planned("reference-1", 1, 2), dialogue: "不管是上班通勤" },
    planned("reference-2", 2, 3),
  ], references), /未说完整/);
  assert.throws(() => validatePlannedShots([
    { ...planned("reference-1", 1, 2), cameraInstruction: "让朋友帮你跟拍。" },
    planned("reference-2", 2, 3),
  ], references, { talentMode: "SELF" }), /他人协助/);
  assert.doesNotThrow(() => validatePlannedShots([
    { ...planned("reference-1", 1, 2), dialogue: "通勤穿也很好看。", cameraInstruction: "把手机放在桌上固定拍摄。" },
    planned("reference-2", 2, 3),
  ], references, { talentMode: "SELF" }));
});
