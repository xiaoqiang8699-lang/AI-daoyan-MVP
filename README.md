# AI Director / AI 导演

把一段参考视频转换成普通人可以逐镜执行的拍摄计划。

当前完成 **Step 3：生成用户专属拍摄方案**。项目是独立的 Next.js 单体应用，使用 PostgreSQL 保存参考分析和用户方案，开发环境使用本地磁盘保存视频与参考帧。

## 已实现流程

1. 在 `/projects/new` 填写项目名称并选择 MP4、MOV 或 WebM 视频（最大 200MB）。
2. 服务端再次校验文件，保存到 `storage/projects/{projectId}/reference/`。
3. ffprobe 读取时长、宽高、帧率和编码格式。
4. KIE AI 或 Gemini Provider 通过结构化输出生成 `ShotPlan[]`。
5. 程序校验字段和时间线；FFmpeg 为每个镜头提取一张真实参考帧。
6. 事务性替换旧 Shot，将项目更新为 `READY_TO_SHOOT`。
7. `/projects/{projectId}/shots` 展示数据库中的参考镜头事实。
8. 用户在 `/projects/{projectId}/brief` 填写要拍的内容、出镜人、地点和其他要求。
9. AI 根据 Reference Shot 生成一一对应的 `PlannedShot`，不重新分析视频，也不覆盖参考数据。
10. `/projects/{projectId}/plan` 默认展示“我的拍法”，支持展开参考镜头、重新生成整套方案和单独更换一镜。

失败的项目会保留并显示简短原因，可以点击“重新分析”。失败不会留下部分新镜头，重新分析也不会累积旧镜头。

## 本地启动

需要 Node.js 22.12+、pnpm 10 和 Docker Desktop / Docker Engine + Compose。

```powershell
Copy-Item .env.example .env
# 在 .env 中填写 KIE_API_KEY；不要把密钥写入 .env.example
pnpm install
docker compose up -d --wait
pnpm db:deploy
pnpm db:seed
pnpm dev
pnpm worker:render
```

- 首页：[http://127.0.0.1:3010](http://127.0.0.1:3010)
- 新建项目：[http://127.0.0.1:3010/projects/new](http://127.0.0.1:3010/projects/new)
- 示例项目：[http://127.0.0.1:3010/projects/demo-project/shots](http://127.0.0.1:3010/projects/demo-project/shots)

开发服务器和 PostgreSQL 都只绑定本机回环地址。当前仍使用固定 Demo User，没有公开部署所需的登录和多用户隔离。

## AI Provider 配置

业务代码只通过 `packages/ai/get-video-ai-provider.ts` 获取 Provider。接口包含参考分析、完整方案生成和单镜替代生成。现有实现：

- `MockVideoAIProvider`：开发和测试用固定结果。
- `KieVideoAIProvider`：先将视频上传到 KIE 临时文件服务，再调用 KIE 的 OpenAI 兼容 Gemini 视频接口。
- `GeminiVideoAIProvider`：Google 官方 SDK 实现，供直接使用 Gemini API 时选择。

默认 `.env.example` 配置 KIE：

```env
VIDEO_AI_PROVIDER=kie
KIE_API_KEY=
KIE_VIDEO_MODEL=gemini-3-8-flash
```

切换到官方 Gemini：

```env
VIDEO_AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_VIDEO_MODEL=gemini-3.8-flash
```

所有密钥只在服务端读取。`.env` 已被 Git 忽略。

## 文件与数据库

```text
storage/projects/{projectId}/
├─ reference/reference.{mp4|mov|webm}
└─ shots/{shotId}/reference.jpg
```

`StorageProvider` 与 `LocalStorageProvider` 位于 `lib/storage/`。文件由受项目归属检查的 `/api/files/...` 路由提供；视频支持 HTTP Range 请求。

## 自动成片

Step 6 通过本地 Redis/BullMQ Worker 执行 FFmpeg 渲染，避免将长任务绑定在 HTTP 请求上。开发时保持 `pnpm worker:render` 运行；`docker compose up -d --wait` 会启动 Redis 和 PostgreSQL。

每个已选 Take 会标准化为 30fps 的 H.264/AAC Segment，再硬切拼接为 MP4。输出按参考视频方向使用 720×1280 或 1280×720；原画面使用等比缩放和模糊背景填充，不会拉伸。生成入口位于拍摄方案和结果页。

Prisma 使用 `Shot` 保存参考事实，并使用独立的 `ShootingBrief`、`ShootingPlan`、`PlannedShot` 保存用户需求和导演方案。完整重新生成先在内存中完成，成功后事务性替换；失败会保留旧方案。Step 3 迁移为 `prisma/migrations/20260916024544_shooting_plan/`。

未来的确定性切镜与多模态语义分析混合方案见 `docs/shot-boundary-strategy.md`；Step 3 没有修改已经稳定运行的 Step 2 视频分析链路。

## 检查命令

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm db:verify
pnpm build
```

集成测试需要已经启动的本地 PostgreSQL。构建完成后可用 `pnpm start` 启动生产服务器；先停止占用 3010 端口的开发服务器。

## 当前范围之外

实时构图检测、人体或姿势识别、Ghost Overlay、字幕、BGM、自动转场、Timeline 编辑器、支付和社交平台链接解析均未实现。
