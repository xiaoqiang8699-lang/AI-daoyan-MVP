# Step 10B-R1 Smoke Queue Isolation Report

## Environment Isolation

- Shared Redis touched: **NO**
- Unknown Worker stopped: **NO**
- Smoke Redis: `127.0.0.1:6381`, DB `0`，仅本机绑定
- Smoke Queue: `material-analysis-smoke`
- BullMQ Prefix: `ai-director-smoke`
- Smoke Worker ID: `material-smoke-13828`
- Consumer Count: `1`
- Queue Isolation Probe: **PASS**。探针由上述唯一 Smoke Worker 返回；旧共享队列 Worker 没有连接此 Redis 实例、前缀或队列。

## Smoke V2

- Batch ID: `cmuqpcekp0008tkracmn40gqn`
- Assets: 6（A 包装盒、B 挂拍、C 动态 MP4、D 陈列、E 噪点、F 本地故障注入）
- Analyzed: 5
- Failed: 1（F，`UPSTREAM_5XX` 本地注入；未发送到 Provider）
- Batch Status: `ANALYZED`，不是 `FAILED`
- 真实页面进度：`0/6` → `1 已理解、1 处理中、4 待处理` → `3 已理解、1 处理中、2 待处理` → `5 已理解、0 处理中、0 待处理、1 失败`。
- Failure Isolation: **PASS**。单素材失败没有阻断其余五条素材、事件聚类或内容发现。

## Worker Chain

从独立 Web 实例创建和上传的新 Batch 进入独立队列后，由唯一 Worker 实际消费。最终链路为：

`MaterialBatch → 6 uploads → material-analysis-smoke → material-smoke-13828 → 5 MaterialAnalysis + 1 isolated failure → StoryEvent → ContentOpportunity → MissingMaterialRequest → Workspace UI`

Event Cluster: **PASS**。

- 事件：`米色针织开衫单品展示`
- 素材：挂拍图与动态展开视频
- 无信息噪点未用于事件或机会。

Content Discovery: **PASS**。

- 机会：`米色针织开衫细节与外观展示`
- 状态：`NEEDS_MORE_MATERIAL`
- sufficiencyScore: `87`，表示现有素材覆盖度，不是播放量或爆款预测。

Missing Material: **PASS**。

1. 领口与纽扣的微距细节：稳定特写、缓慢平移，5 秒。
2. 袖口或下摆收边细节：近景固定拍摄，5 秒。

## Material Understanding Review

- A、B、C、D 的核心主体、场景和动作均与冻结 Ground Truth 一致。
- C 明确识别到“触碰 → 提起 → 展开”的时间动作。
- E 识别为无具象内容的彩色噪点，视觉质量 `POOR`，没有被用于内容机会。
- Severe Hallucination: **0**。机会文案中“质感/弹力”等属于待拍展示目的，未作为已验证的产品材质、销量、到货或人物身份事实。

## UsageLedger

实际写入 `MATERIAL_ANALYSIS`、`EVENT_CLUSTERING` 和 `CONTENT_DISCOVERY` 记录，Provider 为 `kie`，Model 为 `gemini-3-8-flash`。

- 5 次真实素材分析：9,891–12,619 ms。
- 聚类与发现记录了诊断和重整期间的真实调用；最终由独立 Worker 完成的调用分别为 10,487 ms 和 10,051 ms。
- `credits` 与 `currencyCost` 均为 `null`，因为 Provider 未返回可靠费用数据，未估算金额。

## Privacy

- Real User Media Uploaded Externally: **NO**
- Externally processed media: 仅 A–E 专用无隐私 Smoke 素材。
- F 在上传 Provider 前由本地故障注入拦截。

## Result

`SMOKE_TEST_READY=true`
