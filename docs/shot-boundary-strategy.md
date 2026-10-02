# 切镜边界混合策略

## 背景

Step 2 的 57 秒真实视频中，多模态模型把一段快速蒙太奇合并成了一个 5.934 秒镜头。模型适合理解镜头语义，但不应单独承担逐帧边界检测。

Step 3 不替换已经稳定工作的分析链路。本文件只记录下一阶段可单独实施和回归验证的方案。

## 结论

后续采用两阶段混合流程：

```text
确定性候选边界检测
→ 合并过近或低置信度候选
→ 按候选片段向多模态 AI 提供时间范围和代表帧
→ AI 判断语义、镜头用途和可观察事实
→ 程序校验最终时间轴
```

确定性检测负责“哪里可能切了”，多模态 AI 负责“这一段是什么”。AI 可以合并被误切的连续镜头，但不能在没有证据时跨过高置信度硬切边界。

## 候选方案

### FFmpeg scene detection

FFmpeg 内置 `scdet` 会为帧提供变化分数和检测时间，官方文档建议的阈值范围为 8%–14%。也可以使用 `select='gt(scene,...)'` 输出候选帧。

优点：项目已经依赖 FFmpeg，无需增加运行时；适合先做最小实验。缺点：固定阈值容易把快速运镜、闪光或大面积运动误判成切镜，也可能漏掉溶解和相似画面的硬切。

参考：[FFmpeg Filters Documentation](https://ffmpeg.org/ffmpeg-filters.html#scdet)

### PySceneDetect

PySceneDetect 提供 `ContentDetector`、`AdaptiveDetector`、`HistogramDetector` 和 `HashDetector`。其中 AdaptiveDetector 使用邻近帧变化的滚动平均，可降低快速运动产生的误报；HistogramDetector 更偏向快速硬切。

优点：检测器和统计输出成熟，便于离线评估。缺点：引入 Python 运行时和新的部署依赖，不适合在没有准确率收益数据前直接加入当前 Node 单体应用。

参考：[PySceneDetect Detectors](https://www.scenedetect.com/docs/head/api/detectors.html)

### OpenCV 自定义变化检测

可以抽帧后比较亮度或颜色直方图，也可以叠加感知哈希、边缘变化和连续帧规则。

优点：指标和规则完全可控。缺点：需要自行处理采样率、淡入淡出、运动误报、阈值标定和性能，维护成本最高。它更适合作为实验基线，不适合作为第一版生产实现。

参考：[OpenCV Histogram Comparison](https://docs.opencv.org/4.x/d8/dc8/tutorial_histogram_comparison.html)

## 推荐实验顺序

1. 用 FFmpeg `scdet` 输出每个候选边界的时间和 score，不改变现有 Shot。
2. 建立包含硬切、快速运镜、闪光、溶解和快速蒙太奇的标注视频集。
3. 评估 precision、recall，以及候选边界与人工标注的时间误差。
4. 将同一批视频与 PySceneDetect AdaptiveDetector 对比。
5. 选定检测器后，把高置信度边界作为 AI 输入约束，再评估最终 Shot 数量和语义质量。

## 合并规则建议

- 对小于约 0.3 秒的相邻候选先保留分数，避免立刻生成无法拍摄的镜头。
- 高置信度硬切原则上不可被 AI 跨越。
- 低置信度候选允许 AI 根据主体、场景和连续动作合并。
- 溶解或渐变边界记录一个时间区间，最终取区间中点并保留容差。
- 最终仍执行 order、时间递增、不重叠、不越界和最小时长校验。

## Step 3 决策

本阶段不增加 PySceneDetect、OpenCV 或新的边界数据表，也不修改真实视频分析 Prompt 和时间轴写入逻辑。原因是当前没有标注数据支撑阈值选择；直接接入会把实验风险带入已经通过真实验收的 Step 2 链路。
