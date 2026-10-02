import assert from "node:assert/strict";
import { test } from "node:test";
import { parseShotPlans, validateShotPlans } from "../packages/ai/shot-schema";
import { WorkflowError } from "../lib/errors";

const valid = { order: 1, startTime: 0, endTime: 2.4, targetDuration: 2.4, shotSize: "近景", cameraMovement: "固定", visualDescription: "人物拿起杯子。", actionInstruction: "从桌上拿起杯子。", cameraInstruction: "手机放在桌边，保持不动。", dialogue: null };

test("合法镜头可以通过严格校验", () => {
  assert.deepEqual(validateShotPlans([valid], 2.4), [valid]);
});

test("缺字段、负时间和倒置时间会失败", () => {
  const cases = [
    [{ ...valid, actionInstruction: undefined }],
    [{ ...valid, startTime: -1 }],
    [{ ...valid, startTime: 2, endTime: 1, targetDuration: 1 }],
  ];
  for (const value of cases) assert.throws(() => validateShotPlans(value, 2.4), WorkflowError);
});

test("非法 JSON、空镜头和明显越界时间会失败", () => {
  assert.throws(() => parseShotPlans("not json", 2.4), /无法解析/);
  assert.throws(() => validateShotPlans([], 2.4), /有效镜头/);
  assert.throws(() => validateShotPlans([{ ...valid, endTime: 9, targetDuration: 9 }], 2.4), /时间顺序/);
});
