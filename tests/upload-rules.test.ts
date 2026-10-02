import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_TAKE_BYTES, MAX_VIDEO_BYTES, validateTakeVideoFile, validateVideoFile } from "../lib/upload-rules";

test("只允许匹配的 MP4、MOV 和 WebM", () => {
  assert.equal(validateVideoFile("clip.mp4", 20, "video/mp4"), "mp4");
  assert.equal(validateVideoFile("clip.MOV", 20, "video/quicktime"), "mov");
  assert.equal(validateVideoFile("clip.webm", 20, "video/webm"), "webm");
  assert.throws(() => validateVideoFile("clip.txt", 20, "text/plain"), /格式不支持/);
  assert.throws(() => validateVideoFile("clip.mp4", 20, "video/webm"), /不一致/);
  assert.throws(() => validateVideoFile("clip.mp4", MAX_VIDEO_BYTES + 1, "video/mp4"), /200MB/);
});

test("Take 单独限制为 100MB", () => {
  assert.equal(validateTakeVideoFile("take.mp4", MAX_TAKE_BYTES, "video/mp4"), "mp4");
  assert.throws(() => validateTakeVideoFile("take.mp4", MAX_TAKE_BYTES + 1, "video/mp4"), /100MB/);
  assert.throws(() => validateTakeVideoFile("take.exe", 20, "application/octet-stream"), /格式不支持/);
});
