# Take Evaluation Benchmark

## 结论

- 执行时间：2026-09-16（UTC 上传区间 12:52:12–13:06:40）
- Provider / 模型：KIE / `gemini-3-8-flash`
- 最终结果：6 / 6 与人工预期一致，超过 5 / 6 通过线。
- 最终结果文件：`test-results/step5-benchmark-minimal/results-final.json`
- 完整上传审计：`test-results/step5-benchmark-minimal/upload-audit.jsonl`
- 原始 Take 未被修改或覆盖，也没有上传任何原始含脸视频。
- KIE 收到的 Take 全是 Benchmark 副本；全部无人脸、无音频、无原始 metadata，宽度降为 360px。
- KIE 收到的 Reference Clip 只有同一个 0.8 秒、320×180、无人脸、无音频、无 metadata 的最短副本。

## 数据最小化

原始含可识别人脸的 Take 被完整排除。Case A 改用本来就无人脸、仍能验证动作和构图逻辑的真实 Take。Case B、D、F 通过裁切排除屏幕、白板或无关区域；Case C、E 使用本来就无人脸的真实 Take。所有副本重新编码并清除音频与 metadata，原始 Take 保持不变。

Reference Clip 仅保留完成比较所需的 0.8 秒无人脸城市远景。请求正文只包含拍摄要求、确定性检查和随机生成的上传文件名，不包含项目名称、用户姓名、数据库 ID 或本地文件系统路径。

第一次为 Case A 制作的黑色遮挡副本会破坏主体完整性评价，KIE 也把遮挡识别为不可用。该副本被弃用；最终 Case A 改用无人脸原始测试素材，不再通过遮挡改变画面语义。

## 测试环境

- 手机：iPhone 15 Pro Max
- 系统：iOS 26.6.1
- 浏览器：Safari
- 原始手机视频：MP4 / H.264 / AAC，640×480
- Benchmark Take：MP4 / H.264，无音频，360px 宽
- Reference Clip：MP4 / H.264，无音频，320×180，0.8 秒

## 最终 Cases

### Case A：正常完成

- 人工预期 / AI：PASSED / PASSED
- 总分：86
- 五维：framing 85、action 88、movement 82、timing 90、visibility 88
- Critical Issues：无
- confidence：0.95
- mainIssue / advice：无；镜头可以使用

### Case B：主体或商品出画

- 人工预期 / AI：NEEDS_RETAKE / NEEDS_RETAKE
- 总分：10
- 五维：framing 10、action 0、movement 40、timing 80、visibility 0
- Critical Issues：`SUBJECT_MISSING`
- confidence：0.98
- mainIssue：画面中完全未出现针织开衫主体，镜头拍摄的是天花板和照明灯。
- advice：将手机镜头对准针织开衫，固定机位并将整件开衫完整置于画面中央。

### Case C：核心动作缺失

- 人工预期 / AI：NEEDS_RETAKE / NEEDS_RETAKE
- 总分：25
- 五维：framing 40、action 15、movement 35、timing 50、visibility 70
- Critical Issues：`KEY_ACTION_MISSING`
- confidence：0.95
- mainIssue：未拉动控制绳升起百叶窗，核心动作未发生。
- advice：固定手机并完整框入窗框，拍摄中把百叶窗完整升至顶部。

### Case D：时长严重不足

- 人工预期 / AI：NEEDS_RETAKE / NEEDS_RETAKE
- 总分：25
- 五维：framing 30、action 20、movement 30、timing 20、visibility 35
- Critical Issues：`KEY_ACTION_MISSING`
- confidence：0.95
- mainIssue：没有完整展示两个区域，也没有按要求各停一秒，1.76 秒远低于 5 秒目标。
- advice：先对准顶灯停留至少一秒，再缓慢移动到衣架并停留至少一秒。

### Case E：固定机位下的明显晃动

- 人工预期 / AI：NEEDS_RETAKE / NEEDS_RETAKE
- 总分：52
- 五维：framing 75、action 80、movement 45、timing 85、visibility 80
- Critical Issues：`UNUSABLE_VISIBILITY`
- confidence：0.95
- mainIssue：镜头未按要求固定，存在明显手持晃动与位移调整。
- advice：把手机固定在三脚架或桌面支架上，全程保持静止。

### Case F：拍错内容

- 人工预期 / AI：NEEDS_RETAKE / NEEDS_RETAKE
- 总分：15
- 五维：framing 10、action 0、movement 80、timing 80、visibility 0
- Critical Issues：`SUBJECT_MISSING`、`KEY_ACTION_MISSING`
- confidence：0.98
- mainIssue：画面中没有红色马克杯和桌面，也没有转动杯子的动作。
- advice：将红色马克杯放在桌面中央，手握杯柄转动半圈。

## 延迟与消耗

- 最终六次上传阶段：1.540–1.816 秒，中位数 1.706 秒。
- 最终六次模型评价：8.213–21.004 秒，中位数 12.929 秒。
- KIE 返回的最终六次 credits 合计：0.55。
- KIE 曾两次返回 `524 / 2 times retry fail`；脚本按 Case 增量保存，因此不会丢失已经完成的结果。

## Provider 兼容处理

KIE 实际返回过 Schema 外的同义 Critical Issue：`ACTION_INCOMPLETE`、`UNWANTED_CAMERA_MOVEMENT` 和 `CAMERA_SHAKE_OR_UNSTABLE`。Provider 在严格解析前把它们归一为产品枚举 `KEY_ACTION_MISSING` 和 `UNUSABLE_VISIBILITY`，数据库仍只保存产品定义的枚举值。

Prompt 明确补充了固定机位规则：若 PlannedShot 要求手机固定，而画面持续明显漂移、反复摇摆或突发位移，则 movement 必须低于 60，且不能通过。轻微且不影响观看的手震仍然容忍。

## 上传与删除审计

KIE File Upload API 的同一份文档分别出现 24 小时和 3 天的保存表述，因此本项目按最长 **3 天潜在保存期**记录。API 响应未返回 `fileId` 或 `expiresAt`，官方 File Upload API 文档也没有可用的主动删除端点；以下记录的删除状态均为 `NOT_SUPPORTED`，不得假定 24 小时内一定删除。文档：https://docs.kie.ai/file-upload-api/quickstart

所有以下文件都不含可识别人脸。每条均为 `fileId=null`、`expiresAt=null`、`deletionStatus=NOT_SUPPORTED`。

### 已取得 URL 的 24 条上传

- 2026-09-16T12:52:12.948Z · `reference-min.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/reference-clips/1789563132487-j7f6t488pus.mp4`
- 2026-09-16T12:52:13.292Z · `take-a.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563132819-wwmb8n51je.mp4`
- 2026-09-16T12:54:40.882Z · `reference-min.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/reference-clips/1789563280445-y1set7m8yp.mp4`
- 2026-09-16T12:54:41.440Z · `take-a.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563280841-oetixgphex8.mp4`
- 2026-09-16T12:56:17.661Z · `reference-min.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/reference-clips/1789563377108-93od3wto8mn.mp4`
- 2026-09-16T12:56:18.014Z · `take-a.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563377464-akqvdzkrv74.mp4`
- 2026-09-16T12:59:29.162Z · `reference-min.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/reference-clips/1789563568693-dz3wh75aryc.mp4`
- 2026-09-16T12:59:29.570Z · `take-a.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563569095-5z3mdxxcfjo.mp4`
- 2026-09-16T12:59:51.842Z · `take-b.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563591092-21zuixcpp6i.mp4`
- 2026-09-16T13:00:01.828Z · `take-c.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563601304-8stkm394zgd.mp4`
- 2026-09-16T13:00:16.322Z · `take-d.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563615848-krtub1sadg.mp4`
- 2026-09-16T13:00:26.277Z · `take-e.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563625781-i0qvhbw0sog.mp4`
- 2026-09-16T13:00:37.766Z · `take-f.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563637058-ew3rsh8s3fe.mp4`
- 2026-09-16T13:04:13.229Z · `reference-min.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/reference-clips/1789563852748-ok5mw90epcp.mp4`
- 2026-09-16T13:04:13.610Z · `take-c.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563853123-76ftrxeti1g.mp4`
- 2026-09-16T13:04:24.033Z · `take-d.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563863407-6xi55ajx9bx.mp4`
- 2026-09-16T13:04:57.152Z · `reference-min.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/reference-clips/1789563896569-fruzllm4d57.mp4`
- 2026-09-16T13:04:57.433Z · `take-c.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563896969-gr8s1d34zd.mp4`
- 2026-09-16T13:05:07.633Z · `take-e.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563906943-jaeqaunkh.mp4`
- 2026-09-16T13:05:44.133Z · `reference-min.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/reference-clips/1789563943559-y0at3c8166b.mp4`
- 2026-09-16T13:05:44.508Z · `take-c.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563943958-g5bqvx4iz84.mp4`
- 2026-09-16T13:05:59.528Z · `take-e.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563958990-ql3dnawb5b.mp4`
- 2026-09-16T13:06:39.537Z · `reference-min.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/reference-clips/1789563999081-fgrwojnzkt.mp4`
- 2026-09-16T13:06:40.106Z · `take-e.mp4` · `https://tempfile.redpandaai.co/kieai/684291/ai-director/evaluation/takes/1789563999608-3vkwuib10fa.mp4`

### 早期无 URL 的 2 条上传

第一次解析失败发生在落盘审计启用之前，已知 KIE 接收了一个 `reference-min.mp4` 和一个弃用的黑色遮挡 `take-a.mp4`。两者同样无人脸、无音频、无 metadata，但该次响应中的 URL、fileId 和精确上传时间未保存，无法补录或主动删除。它们也按最长 3 天潜在保存期处理。

## 最终判断

Benchmark 达到 6 / 6，`mainIssue` 和建议都与可见证据一致。模型能区分可用镜头与主体缺失、核心动作缺失、严重时长不足、固定机位违例及错误内容。当前真实风险是 KIE 偶发 524，以及 File Upload API 没有可用的主动删除能力；业务侧已经保留失败状态与重新评价入口。
