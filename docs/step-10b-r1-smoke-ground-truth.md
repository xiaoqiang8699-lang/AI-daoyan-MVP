# Step 10B-R1 混合素材 Smoke Ground Truth

冻结时间：2026-10-02，首次混合素材真实 Provider 调用前。

- Asset A（`a-unbox.png`）：米色针织开衫折叠放置于打开的纸盒和白色衬纸中。与 B、C 有明显相同商品主题关系；不可推断新品、到货、开箱动作、快递或销售。
- Asset B（`b-cardigan.png`）：米色 V 领针织开衫悬挂展示。与 A、C 有明显相同商品主题关系。
- Asset C（`cardigan-lift.mp4`）：米色针织开衫从静止状态，经手部触碰，被拿起并展开。与 A、B 有明显相同商品主题关系。
- Asset D（`c-rack.png`）：无人物室内服装陈列环境。可独立成 Event，也可作为服装展示环境上下文；不可推断门店、营业、店员、顾客或销售。
- Asset E（`e-noise.png`）：无信息价值的抽象噪声图片；应保持 unassigned，不得作为 Content Opportunity Evidence。
- Asset F（`f-forced-failure.png`）：开发期强制 `UPSTREAM_5XX`；应为 `FAILED`，且不得导致 Batch 失败或被上传到外部 Provider。

所有媒体均为专门测试资产：无真实用户、可识别人脸、个人信息、私人音频、地址或商业敏感内容。
