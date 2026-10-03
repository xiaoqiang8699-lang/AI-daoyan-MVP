# Step 10C 最终待验收清单

当前状态：

- `STEP_10C1_ENGINEERING_READY=true`
- `STEP_10C1_DEVICE_ACCEPTANCE_PENDING=true`
- `STEP_10C2_ENGINEERING_READY=true`
- `STEP_10C2_RENDER_QUALITY_READY=true`
- `STEP_10C2_DESKTOP_MEDIA_ACCEPTANCE_PENDING=true`
- `STEP_10C2_DEVICE_ACCEPTANCE_PENDING=true`
- `STEP_10C2_READY=false`
- `SMART_TRIM_PRODUCTION=PASS`

已验证：Render、Smart Trim、字幕生成、BGM 渲染、BGM OFF 渲染、程序 Final QA、OUTDATED、重新生成和时长误差均通过。

Codex Browser 无法访问本地 HTTPS 媒体时，以下项目统一记为 `BLOCKED_BY_TEST_ENVIRONMENT`：Playback、Seek、Audio、Download。字幕视觉验收和 BGM 听感验收记为 `NOT_TESTED`；下载文件 ffprobe 记为 `NOT_RUN`。

## A. iPhone Capture Acceptance

设备：iPhone Safari，同一局域网 HTTPS。

- [ ] 打开 CaptureTask 拍摄页。
- [ ] 点击“准备拍摄”后允许摄像头与麦克风权限。
- [ ] 预览画面正常显示。
- [ ] 前后摄像头切换正常。
- [ ] 点击录制后完成 3 秒倒计时并开始录制。
- [ ] 录制计时增长正常。
- [ ] 点击红色停止按钮后进入 Review。
- [ ] 开发诊断记录 `CAPTURE_STOP_POINTER_DOWN`、`CAPTURE_STOP_CLICK`、`CAPTURE_STOP_CALLED`、`CAPTURE_ONSTOP` 的实际结果。
- [ ] Review 可播放刚拍视频。
- [ ] 重新拍摄不创建 Take。
- [ ] 使用这条后创建 Take、完成 TASK_ONLY Evaluation，并可由用户接受。
- [ ] 离开 Review 或页面后摄像头流已释放。
- [ ] 390px 宽度下完整流程无明显布局问题。

## B. Desktop FinalVideo Acceptance

在普通桌面浏览器（不使用 Codex Browser）打开：

`/workspace/produce/[productionId]/result`

- [ ] 页面正常打开。
- [ ] Full Source 与 Smart Trim 成片可播放至结尾。
- [ ] 可 Seek 至中部并回到前部。
- [ ] 音频正常。
- [ ] 字幕清晰且基本同步。
- [ ] BGM 不盖住原声音频。
- [ ] BGM OFF 版本仍可播放、Seek 和下载。
- [ ] 无异常黑屏或明显音画不同步。
- [ ] 下载按钮正常。
- [ ] 下载文件可由 ffprobe 读取，且包含有效 H.264 视频和音轨。

## C. iPhone FinalVideo Acceptance

设备：iPhone Safari，同一局域网 HTTPS。

- [ ] 打开 Production Result 页面。
- [ ] Full Source 成片完整播放。
- [ ] Smart Trim 成片完整播放。
- [ ] 拖动进度到中部和前部均正常。
- [ ] 播放至结尾正常。
- [ ] 字幕清晰且基本同步。
- [ ] BGM 不明显盖过原声音频。
- [ ] 无异常黑屏、卡顿或音画不同步。
- [ ] 下载正常。
- [ ] 下载后 iPhone 系统播放器正常播放。
