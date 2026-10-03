import assert from "node:assert/strict";
import test from "node:test";
import { capturePhaseAfterStop, stopMediaRecorder, type RecorderLike } from "../lib/capture-recorder";

function recorder(state: RecorderLike["state"]) { const calls = { stop: 0, data: 0 }; return { value: { state, stop: () => { calls.stop += 1; }, requestData: () => { calls.data += 1; } }, calls }; }
test("录制中的 MediaRecorder 只停止一次", () => { const item = recorder("recording"); const stopping = { current: false }; assert.equal(stopMediaRecorder(item.value, stopping), true); assert.equal(stopMediaRecorder(item.value, stopping), false); assert.equal(item.calls.stop, 1); assert.equal(item.calls.data, 1); });
test("暂停的 MediaRecorder 可以停止", () => { const item = recorder("paused"); assert.equal(stopMediaRecorder(item.value, { current: false }), true); assert.equal(item.calls.stop, 1); });
test("inactive MediaRecorder 不会重复停止", () => { const item = recorder("inactive"); assert.equal(stopMediaRecorder(item.value, { current: false }), false); assert.equal(item.calls.stop, 0); });
test("onstop 后进入 Review", () => { assert.equal(capturePhaseAfterStop(), "REVIEW"); });
