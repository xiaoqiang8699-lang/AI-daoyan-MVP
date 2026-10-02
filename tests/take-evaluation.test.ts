import assert from "node:assert/strict";
import { test } from "node:test";
import { applyEvaluationPolicy, deterministicTakeChecks, EVALUATION_POLICY } from "../packages/ai/evaluation-policy";
import type { TakeEvaluation } from "../packages/ai/types";

function result(overrides: Partial<TakeEvaluation> = {}): TakeEvaluation {
  return {
    passed: true,
    overallScore: 88,
    dimensions: { framing: 88, action: 88, movement: 88, timing: 88, visibility: 88 },
    criticalIssues: [],
    mainIssue: null,
    advice: "这条可以使用。",
    confidence: 0.9,
    evidence: null,
    issueStartTime: null,
    issueEndTime: null,
    ...overrides,
  };
}

test("通过策略要求无 Critical Failure 且核心维度达到集中阈值", () => {
  assert.equal(applyEvaluationPolicy(result()).passed, true);
  assert.equal(applyEvaluationPolicy(result({ overallScore: 95, dimensions: { framing: 95, action: 30, movement: 95, timing: 95, visibility: 95 } })).passed, false);
  assert.equal(applyEvaluationPolicy(result({ criticalIssues: ["KEY_ACTION_MISSING"] })).passed, false);
  assert.equal(applyEvaluationPolicy(result({ passed: false, dimensions: { framing: 90, action: 90, movement: 30, timing: 30, visibility: 90 } })).passed, false);
  assert.deepEqual(EVALUATION_POLICY.minimumScores, { action: 65, framing: 60, visibility: 60 });
});

test("确定性检查记录时长和方向 warning，不因 0.1 秒误差失败", () => {
  const normal = deterministicTakeChecks({ take: { duration: 3.9, width: 1080, height: 1920 }, targetDuration: 4, referenceVideo: { width: 1080, height: 1920 } });
  assert.deepEqual(normal.warnings, []);
  const abnormal = deterministicTakeChecks({ take: { duration: 1, width: 1920, height: 1080 }, targetDuration: 4, referenceVideo: { width: 1080, height: 1920 } });
  assert.deepEqual(abnormal.warnings, ["DURATION_OUT_OF_RANGE", "ORIENTATION_MISMATCH"]);
  assert.equal(abnormal.durationRatio, 0.25);
});
