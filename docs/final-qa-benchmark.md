# Final QA Benchmark

执行时间：2026-09-17。测试资产位于 `test-fixtures/final-qa/`，均由 FFmpeg `testsrc2`、色块、正弦测试音和测试字幕生成；不包含人物、真实姓名、联系方式、地址、二维码、车牌或用户视频。

程序层检查使用 ffprobe（可读性、时长、分辨率、fps、编码）、音轨存在性和 FFmpeg `blackdetect`。结果在 `test-results/final-qa-benchmark/results.json`。

| Case | 构造 | 预期 | 程序结果 |
| --- | --- | --- | --- |
| A | 正常 720×1280、6 秒、H.264/AAC 测试成片 | `PASSED` | `PASSED` |
| B | 中间插入 2 秒纯黑 | `BLACK_SCREEN` | `BLACK_SCREEN` |
| C | 将测试字幕固定在画面中心 | `SUBTITLE_BLOCKING_SUBJECT` | 需要多模态 AI；程序层不推断主体位置。 |
| D | 删除音轨 | `AUDIO_MISSING` | `AUDIO_MISSING` |

程序层 3 / 4 符合预期，满足 Step 8 的最低门槛。损坏文件会在 ffprobe 阶段拒绝，无法进入 `PASSED`。

多模态 Final QA 仍为 Beta：KIE 在此前受限测试中出现 524，且本次没有向 KIE 上传任何用户视频或本套公开测试资产；接口 `evaluateFinalVideo()` 和 KIE Provider 均保留，当前业务成片采用可靠的程序层 QA，不把 Provider 不稳定作为 MVP 阻塞条件。
