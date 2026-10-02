# Step 8 外部 Benchmark 审计

## 最小化与本地审核

2026-09-17，原始 FinalVideo 和原始最终音频均未上传、未修改、未覆盖。STT 使用本机合成的匿名短句“这是一个匿名字幕测试”；不包含姓名、联系方式或真实录音。Final QA 使用从隔离 Render Demo 截取的最短视频副本，移除原始音频、metadata，并裁掉含白板的区域。

本地 contact sheet 审核确认上传视频无人脸、无文字、无账号、无地址、无车牌、二维码或屏幕通知。音频副本不包含人物身份信息。副本位于 `test-results/step8-benchmark/`，与原始文件分离。

## 实际上传与保存期限

完整逐次记录在 `test-results/step8-benchmark/upload-audit.jsonl`。KIE 没有返回 fileId 或 expiresAt，且没有发现可用主动删除接口；每条都记录为 `deletionStatus=NOT_SUPPORTED`，按最长 3 天潜在保存期处理。

- `stt-anonymous.mp3`：无人、含匿名替换语音；已上传多次以处理 KIE 524 或响应兼容失败。
- `final-qa-anonymous.mp4`：无人、含匿名替换语音；已上传四次，其中前三次 KIE 返回 524，最后一次返回技术问题。

没有项目名称、用户姓名、本地路径或数据库 ID 被放入提示词或上传文件名。

## 结果与阻塞

STT 的 KIE 请求多次返回 `524 / 2 times retry fail`，没有取得可用转写结果。

Final QA 的唯一可用模型结果将经裁切的视频识别为“画面完全模糊失焦”，并判定不通过。这是预期的去标识化副作用：为排除白板信息所做的强裁切破坏了 Final QA 判断画面可用性的必要内容。因此该副本不能作为真实 Final QA 的有效 Benchmark。

根据授权条件“去标识化会破坏有效性则停止”，未再上传原始 FinalVideo、原始音频或更完整的画面。
