import assert from "node:assert/strict";
import { test } from "node:test";
import { validateTranscript } from "../lib/enhancement";

test("字幕只保留 FinalVideo 时间轴内的有效片段", () => {
  assert.deepEqual(validateTranscript([{ startTime: -1, endTime: 1, text: "忽略" }, { startTime: 0.1, endTime: 1.2, text: "  你好，世界  " }, { startTime: 2, endTime: 1, text: "无效" }], 2), [{ startTime: 0.1, endTime: 1.2, text: "你好，世界" }]);
});

test("长字幕按可读片段分配原始时间，不丢失文字", () => {
  const result = validateTranscript([{ startTime: 0, endTime: 4, text: "这是一句足够长的中文口播，用于验证字幕不会被截断成无法理解的半句话。" }], 4);
  assert.equal(result.map((item) => item.text).join(""), "这是一句足够长的中文口播，用于验证字幕不会被截断成无法理解的半句话。");
  assert.equal(result[0].startTime, 0);
  assert.equal(result.at(-1)?.endTime, 4);
});
