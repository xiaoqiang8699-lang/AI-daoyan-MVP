# Step 8 最终验收记录

验收日期：2026-09-17。

## 本地 STT 与字幕

- Provider：`LocalWhisperProvider`，`faster-whisper 1.2.1`，Whisper `base`，CPU `int8`。
- 数据流：FinalVideo 本地音频 → 本地 STT → `TranscriptSegment[]` → ASS → FFmpeg 烧录；没有向第三方上传音频。
- Benchmark：A 清晰中文、B 轻度环境噪音、C 短句、D 静音、E 隔离 Render Demo Smart Trim 音频均可用（5 / 5）。静音没有产生幻觉字幕。
- 详细结果：[subtitle-benchmark.md](subtitle-benchmark.md)。

## Final QA Demo

- 专用公开测试资产位于 `test-fixtures/final-qa/`，由测试图、色块、测试音和测试字幕生成，不含真实用户视频、人物或身份信息。
- 程序层基于 ffprobe、音轨存在性与 FFmpeg `blackdetect` 验证可读性、时长、分辨率、fps、编码、黑屏和缺失音轨。
- 正常、黑屏、缺失音轨 3 / 4 Case 命中预期；中心字幕遮挡保留为多模态 AI 的 Beta 检查。
- 详细结果：[final-qa-benchmark.md](final-qa-benchmark.md)。

## A / B / C 输出

| 版本 | 内容 | 时长 | 文件大小 | 渲染耗时 | 字幕 | BGM | 程序 QA |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| A | Smart Trim Base | 19.876 秒 | 3,864,254 B | 23,975 ms | 关闭 | 无 | PASSED |
| B | Smart Trim + Subtitle | 19.876 秒 | 3,878,372 B | 24,166 ms | READY | 无 | PASSED |
| C | Smart Trim + Subtitle + BGM | 19.867 秒 | 3,870,603 B | 24,160 ms | READY | 轻松，14% | PASSED |

输出和原始结果位于 `test-results/step8-acceptance/`。

## iPhone Version C 真机验收

- 设备：iPhone 15 Pro Max。
- 浏览器：Safari。
- 环境：同一局域网的本地 HTTPS。
- 完整播放、拖动进度、播放至结尾、下载视频、下载后系统播放器播放：通过。
- 字幕：清晰；时间有轻微偏差；没有被截断或难以理解的句子。
- BGM：偏小；没有盖住口播。
- 黑屏或异常画面：无。
- 音画不同步：无。
- 整体观感：基本可用但需要优化。

## Provider 状态与实际问题

- KIE：此前受限 Benchmark 曾出现 524；本次字幕验收未依赖 KIE，真实用户媒体没有上传。
- 多模态 AI Final QA：Beta / Provider blocked；不阻塞 MVP。
- 当前实际问题：字幕仍有轻微时间偏差；Version C 的 BGM 音量偏小。
