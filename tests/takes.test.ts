import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCaptureProgress, validateTakeMetadata } from "../lib/takes";

test("拍摄进度分别计算已拍、跳过和未拍，SKIPPED 不算完成", () => {
  assert.deepEqual(calculateCaptureProgress(["CAPTURED", "SKIPPED", "NOT_STARTED", "CAPTURED"]), {
    total: 4,
    captured: 2,
    skipped: 1,
    notStarted: 1,
  });
});

test("Take metadata 拒绝超过 30 秒的视频", () => {
  assert.throws(() => validateTakeMetadata({ duration: 30.1, width: 1080, height: 1920, fps: 30, codec: "h264" }), /最长 30 秒/);
  assert.deepEqual(validateTakeMetadata({ duration: 2.8, width: 1080, height: 1920, fps: 30, codec: "h264" }), { duration: 2.8, width: 1080, height: 1920, fps: 30, codec: "h264" });
});
