# Step 1 范围与验收

## 边界

独立单体 Next.js 工程。数据持久化使用 PostgreSQL + Prisma；页面通过 Server Components 读取数据、Server Actions 创建项目与写入固定镜头，无需额外 REST API。

新项目：`ANALYZING` → 调用固定数据 Provider → 事务创建 5 个 `READY` 镜头并设为 `READY_TO_SHOOT`。同一项目重复分析通过状态条件和镜头唯一约束避免重复写入。

当前不推进 `SHOOTING`、`PASSED` 或 `COMPLETED`，这些状态只在模型中预留。

## 路由

- `/`：产品首页。
- `/projects`：数据库项目列表及空状态。
- `/projects/new`：名称表单、本地视频预览、示例分析入口。
- `/projects/[id]`：根据是否已有镜头跳转至分析或计划。
- `/projects/[id]/analysis`：分析等待、失败重试与完成状态。
- `/projects/[id]/shots`：镜头卡片和拍摄入口。
- `/projects/[id]/shoot/[shotId]`：当前进度、参考画面、动作、相机位置、台词与拍摄占位按钮。
- `/projects/[id]/result`：成片占位。

不存在的项目或不属于项目的镜头显示 404；数据库加载失败显示中文重试界面。

## 自动检查覆盖

- Mock Provider：5 镜头、连续时间、操作指导、独立返回数据、通过/失败评价。
- 数据库：示例关联、镜头数及顺序、一项目一个参考视频、镜头序号唯一、评分边界、评价与选用素材关系。
- TypeScript、ESLint、Next.js 生产构建。

## 手动检查重点

- 浏览器内完成新建项目、等待分析、打开计划与单镜页面。
- 刷新后仍能查看项目和镜头。
- 320 / 390 像素手机宽度下不横向溢出，说明和按钮可读可用。
- 开始拍摄只提示待开放，不打开摄像头；成片页面没有渲染任务。
