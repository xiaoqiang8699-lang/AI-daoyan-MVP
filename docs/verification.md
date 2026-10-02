# Step 1 验证记录

验证日期：2026-09-15。环境：Windows、Node.js 24.13.0、pnpm 10.34.5、Docker Compose 5.5.1。

## 已通过

- `pnpm install`：完成安装，生成 `pnpm-lock.yaml` 和 Prisma Client。
- `docker compose up -d --wait`：PostgreSQL 17 容器健康，端口 `127.0.0.1:55432`。
- `pnpm db:migrate`：初始迁移成功应用，数据库与 schema 同步。
- `pnpm db:seed`：成功；重复执行后示例数据不重复。
- `pnpm dev`：成功启动在 `http://127.0.0.1:3010`。
- `pnpm typecheck`、`pnpm lint`：均成功退出。
- `pnpm test`：2 项 Mock Provider 测试通过。
- `pnpm db:verify`：示例数据、关系和数据库约束验证通过；测试事务已回滚。
- `pnpm build`：最终生产构建通过，全部页面路由生成成功。

## 浏览器验证

- 首页 → 项目列表 → 示例项目 → 5 个镜头 → 第一镜 → 第二镜导航成功。
- 每个示例参考图正常加载，页面显示动作、相机位置、台词和时长。
- “开始拍摄”显示待开放提示。
- 新建项目：纯空白名称被拒绝；合法名称成功创建项目并生成 5 个镜头。
- 新项目分析页刷新后仍为完成状态，数据库确认只有 5 个镜头。
- 新项目计划页和成片占位页可访问，浏览器未记录控制台错误。
- 390 像素下检查计划页面；320 像素下检查首页、计划页及单镜页面。滚动条占宽后 `scrollWidth` 均等于 `clientWidth`，无横向溢出，截图检查未发现明显错位。

验收临时项目已按固定 ID 清理。最终数据库保留 1 个 User、1 个 Project、1 个 ReferenceVideo、5 个 Shot，无 Take。

## 环境说明

本机沙箱会阻止 Docker 访问和部分 Node.js / Prisma 子进程启动（EPERM）；在获准的沙箱外执行后，上述检查均通过。

依赖安装存在 ESLint 9 弃用提醒。当前使用 Next.js 配套 lint 配置，lint 验证通过；没有阻塞 Step 1 的运行问题。

本轮未验证真实视频上传、摄像头、真实 AI 或最终渲染，这些功能按范围尚未实现。
