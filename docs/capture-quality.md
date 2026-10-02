# Capture Quality

## 当前实测

- 设备：iPhone 15 Pro Max
- 系统：iOS 26.6.1
- 拍摄入口：Safari，通过同一局域网内的受信任 HTTPS 地址访问
- `getUserMedia`：`video: { facingMode: { ideal: "environment" } }`、`audio: true`
- MediaRecorder 实际文件：MP4、H.264 视频、AAC 音频
- 实际分辨率：640 × 480
- 实际宽高比：4:3（1.333）
- 当前参考视频：1280 × 720
- 参考视频宽高比：16:9（1.778）

当前版本没有指定理想分辨率，也没有裁切或拉伸摄像头流。录制后的服务端 `ffprobe` 结果是最终可信 metadata；浏览器返回的 `MediaTrackSettings` 仅用于后续调试，不作为上传数据的信任边界。

## 后续提升方案

先尝试在 `getUserMedia` 中使用软约束请求 720p，例如横屏使用 `width: { ideal: 1280 }`、`height: { ideal: 720 }`，竖屏使用 `width: { ideal: 720 }`、`height: { ideal: 1280 }`。设备支持且链路稳定后，再评估 1080p。

请求成功后读取 `videoTrack.getSettings()`，记录浏览器实际选择的宽、高、宽高比、帧率和 facingMode。UI 继续以真实画面比例预览，不强制裁切为 9:16。

## Fallback

1. 理想 720p 约束失败时，去掉分辨率约束并重试当前稳定配置。
2. `getUserMedia` 或 `MediaRecorder` 不可用时，保留“从相册选择视频”。
3. 服务端继续使用 `ffprobe` 检查时长、宽高、编码和 100MB / 30 秒限制。
4. 分辨率提升不得阻塞 Step 5，也不得改变已验证可用的 iPhone 拍摄流程。
