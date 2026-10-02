# Trim Benchmark

## 数据范围与人工审核

2026-09-16：本次仅使用 `test-results/trim-benchmark/` 中新生成的六条 Benchmark 副本和一条 0.8 秒 Reference Clip。副本从既有的已去标识化 Step 5 测试副本重新转码而来；所有文件仅含视频流、无音频、移除 metadata，文件名不含项目、用户、路径或数据库标识。

人工逐帧抽检六个 review contact sheet：均未发现可识别人脸、姓名、屏幕或白板文字。原始 Take 未读取为外传素材、未修改、未覆盖。KIE 仅可收到下列匿名副本；其 API 没有已知主动删除端点，因此按最长 3 天潜在保存期处理，删除状态记录为 `NOT_SUPPORTED`。

## 上传审计

KIE 未返回 fileId 或 expiresAt，且没有可用主动删除端点；全部记录为 `NOT_SUPPORTED`。所有上传文件均为无人脸、无音频的 Benchmark 副本。完整、逐次 URL 审计（含两次 schema 兼容重试和一次 524 重试）在 `test-results/trim-benchmark/upload-audit.jsonl`；共 31 个临时 URL，均按最长 3 天潜在保存期处理。

最终成功请求对应的 URL：

- A：2026-09-16T14:09:58.880Z `trim-a.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/trim/takes/1789567798391-tw1tg6hh0q.mp4`
- B：2026-09-16T14:10:26.611Z `trim-b.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/trim/takes/1789567825807-g9njtucev4.mp4`
- C：2026-09-16T14:11:01.969Z `trim-c.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/trim/takes/1789567861501-nb78v7thsv.mp4`
- D：2026-09-16T14:11:28.654Z `trim-d.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/trim/takes/1789567888233-4cqfhr7bczg.mp4`
- E：2026-09-16T14:11:50.523Z `trim-e.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/trim/takes/1789567909516-09k1gtumklk9.mp4`
- F：2026-09-16T14:12:17.835Z `trim-f.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/trim/takes/1789567937368-wk6lrwcko8.mp4`

Reference Clip 也只上传匿名的 `reference-clip.mp4`；每次成功请求的 URL 在同一 JSONL 中紧邻对应 Take。文件名、提示词和请求正文未携带项目名称、用户名、本地路径或数据库 ID。

## 结果

| Case | AI 裁切结果 | 策略结果 | 人工判断 |
| --- | --- | --- | --- |
| A | 0.100–2.700s，0.85 | AUTO | 合理 |
| B | 0.000–2.700s，0.40 | FULL_TAKE | 合理：主体不符，不能强剪 |
| C | 0.000–2.600s，0.85 | AUTO | 合理 |
| D | 0.000–1.766s，0.30 | FULL_TAKE | 合理：无可用动作 |
| E | 0.064–7.064s，0.85 | AUTO | 合理 |
| F | 0.000–3.596s，0.20 | FULL_TAKE | 合理：拍错内容 |

6 / 6 与人工判断一致：3 条保守采用 AUTO，3 条自动回退完整 Take。逐 Case 的最终结构化结果和耗时在 `test-results/trim-benchmark/results-final.json`；A/B 成片的可复核数据在 `ab-results.json`。

## A/B 成片

同一隔离 Render Demo 的 Full Take 成片为 21.022 秒、4,119,593 B；Smart Trim 成片为 19.876 秒、3,864,254 B，实际渲染耗时 18,348ms。两个 MP4 分别保存在 `test-results/trim-benchmark/full-take-ab.mp4` 和 `smart-trim-ab.mp4`。Smart Trim 只采用两个高置信度、与匿名 Benchmark 时间轴相同的副本结果；其余镜头回退完整 Take，未上传 Render Demo 原始素材。
