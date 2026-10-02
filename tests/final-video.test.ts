import assert from "node:assert/strict";
import { test } from "node:test";
import { missingSelectedShots, safeTrim, sourcesOutdated } from "../lib/final-video";

test("成片资格要求每个 PlannedShot 都有 selectedTakeId", () => {
  assert.deepEqual(missingSelectedShots([{ id: "one", order: 1, selectedTakeId: "take-one" }, { id: "two", order: 2, selectedTakeId: null }]), [{ id: "two", order: 2 }]);
});

test("source snapshot 严格按 PlannedShot.order 比较，用于过期判断", () => {
  const sources = [{ plannedShotId: "one", takeId: "take-one", order: 1 }, { plannedShotId: "two", takeId: "take-two", order: 2 }];
  assert.equal(sourcesOutdated(sources, sources), false);
  assert.equal(sourcesOutdated([{ ...sources[0] }, { ...sources[1], takeId: "replacement" }], sources), true);
  assert.equal(sourcesOutdated([{ ...sources[1] }, { ...sources[0] }], sources), true);
  assert.equal(sourcesOutdated([{ ...sources[0], trimStart: 0.2 }, sources[1]], sources), true);
});

test("低置信度或非法裁切回退到完整 Take", () => {
  assert.equal(safeTrim({ duration: 3, targetDuration: 2, dialogue: null, trim: { id: "x", startTime: 0.1, endTime: 2, confidence: 0.9 } }).source, "AUTO");
  assert.equal(safeTrim({ duration: 3, targetDuration: 2, dialogue: null, trim: { id: "x", startTime: 0.1, endTime: 2, confidence: 0.2 } }).source, "FULL_TAKE");
});
