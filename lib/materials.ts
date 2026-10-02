import "server-only";
import { db } from "./db";
import { DEMO_USER_ID } from "./demo-user";
import { WorkflowError } from "./errors";
import { recordProductEvent, recordUsage } from "./analytics";
import { AnalyticsEvent } from "./analytics-events";
import { getMaterialAIConfig, getMaterialAIProvider } from "@/packages/ai/get-material-ai-provider";
import { getStorageProvider } from "./storage";

const READY_THRESHOLD = 75;
const goalText = "随便看看今天有什么能发";

export async function getMaterialBatch(id: string) {
  const batch = await db.materialBatch.findFirst({ where: { id, userId: DEMO_USER_ID }, include: { assets: { orderBy: { createdAt: "asc" }, include: { analysis: true } }, events: { include: { materials: true } }, opportunities: { include: { segments: true, missingMaterials: true }, orderBy: { createdAt: "asc" } } } });
  if (!batch) throw new WorkflowError("MATERIAL_BATCH_NOT_FOUND", "找不到这组素材。", 404);
  return batch;
}

export async function getLatestMaterialBatch() {
  const item = await db.materialBatch.findFirst({ where: { userId: DEMO_USER_ID }, orderBy: { createdAt: "desc" }, select: { id: true } });
  return item ? getMaterialBatch(item.id) : null;
}

const safeError = (error: unknown) => error instanceof WorkflowError ? error.message : "素材分析失败，请稍后重试。";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const qualityScore = (quality: "GOOD" | "USABLE" | "POOR") => quality === "GOOD" ? 100 : quality === "USABLE" ? 65 : 20;

function shouldForceFailure(assetId: string, index: number, total: number) {
  if (process.env.NODE_ENV === "production") return false;
  const target = process.env.SMOKE_FORCE_ASSET_FAILURE;
  return target === assetId || (target === "LAST" && index === total - 1);
}

function smokeDelayMs() {
  if (process.env.NODE_ENV === "production") return 0;
  const value = Number(process.env.SMOKE_ANALYSIS_DELAY_MS || 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 10_000)) : 0;
}

export async function analyzeMaterialBatch(batchId: string) {
  const batch = await getMaterialBatch(batchId);
  if (!batch.assets.length) throw new WorkflowError("NO_MATERIALS", "请先添加至少一条素材。", 422);

  const provider = getMaterialAIProvider();
  const config = getMaterialAIConfig();
  await db.materialBatch.update({ where: { id: batchId }, data: { status: "ANALYZING", analysisStartedAt: new Date(), errorMessage: null } });
  await recordProductEvent({ eventName: AnalyticsEvent.MATERIAL_ANALYSIS_STARTED, eventData: { assetCount: batch.assets.length } });

  for (const [index, asset] of batch.assets.entries()) {
    if (asset.analysisStatus === "ANALYZED" && asset.analysis) continue;
    const started = Date.now();
    try {
      await db.materialAsset.update({ where: { id: asset.id }, data: { analysisStatus: "ANALYZING", analysisError: null } });
      if (shouldForceFailure(asset.id, index, batch.assets.length)) throw new WorkflowError("UPSTREAM_5XX", "测试注入：上游服务暂时不可用。", 502);
      const localFile = await getStorageProvider().getLocalFile(asset.storageKey);
      const result = await provider.analyzeMaterial({ assetId: asset.id, localFilePath: localFile.path, mimeType: asset.mimeType, type: asset.type, duration: asset.duration });
      const { rawResult: _ignored, ...analysis } = result;
      await db.materialAnalysis.upsert({ where: { materialAssetId: asset.id }, create: { materialAssetId: asset.id, ...analysis, provider: config.provider, model: config.model }, update: { ...analysis, provider: config.provider, model: config.model } });
      await db.materialAsset.update({ where: { id: asset.id }, data: { analysisStatus: "ANALYZED" } });
      await recordProductEvent({ eventName: AnalyticsEvent.MATERIAL_ANALYSIS_COMPLETED, eventData: { type: asset.type } });
      await recordUsage({ operation: "MATERIAL_ANALYSIS", provider: config.provider, model: config.model, durationMs: Date.now() - started, currencyCost: config.provider === "mock" ? 0 : null });
    } catch (error) {
      await db.materialAsset.update({ where: { id: asset.id }, data: { analysisStatus: "FAILED", analysisError: safeError(error) } });
      await recordProductEvent({ eventName: AnalyticsEvent.MATERIAL_ANALYSIS_FAILED, eventData: { type: asset.type } });
    }
    const wait = smokeDelayMs();
    if (wait) await delay(wait);
  }

  const refreshed = await getMaterialBatch(batchId);
  const usable = refreshed.assets.filter((asset) => asset.analysisStatus === "ANALYZED" && asset.analysis).map((asset) => ({ assetId: asset.id, capturedAt: asset.capturedAt, analysis: { summary: asset.analysis!.summary, scene: asset.analysis!.scene, activity: asset.analysis!.activity, objects: Array.isArray(asset.analysis!.objects) ? asset.analysis!.objects.map(String) : [], topics: Array.isArray(asset.analysis!.topics) ? asset.analysis!.topics.map(String) : [], speechSummary: asset.analysis!.speechSummary, visualQuality: asset.analysis!.visualQuality, storyPotential: asset.analysis!.storyPotential, confidence: asset.analysis!.confidence } }));

  if (!usable.length) {
    await db.materialBatch.update({ where: { id: batchId }, data: { status: "FAILED", errorMessage: "没有可用素材完成分析。" } });
    throw new WorkflowError("NO_USABLE_MATERIAL", "没有可用素材完成分析。", 422);
  }
  if (usable.length < 2) {
    await db.materialBatch.update({ where: { id: batchId }, data: { status: "ANALYZED", analysisCompletedAt: new Date(), errorMessage: "可用素材太少，暂时无法发现内容机会。" } });
    return null;
  }

  const eventStarted = Date.now();
  const clustered = await provider.clusterEvents({ assets: usable });
  await recordUsage({ operation: "EVENT_CLUSTERING", provider: config.provider, model: config.model, durationMs: Date.now() - eventStarted, currencyCost: config.provider === "mock" ? 0 : null });
  const usableIds = new Set(usable.map((item) => item.assetId));
  const claimed = new Set<string>();
  for (const event of clustered.events) for (const id of event.assetIds) {
    if (!usableIds.has(id) || claimed.has(id)) throw new WorkflowError("ProviderResponseInvalid", "素材 AI 返回了无效的事件关联。", 422);
    claimed.add(id);
  }
  const unassigned = new Set<string>();
  for (const id of clustered.unassignedAssetIds) {
    if (!usableIds.has(id) || claimed.has(id) || unassigned.has(id)) throw new WorkflowError("ProviderResponseInvalid", "素材 AI 返回了无效的未归组关联。", 422);
    unassigned.add(id);
  }
  if (claimed.size + unassigned.size !== usableIds.size) throw new WorkflowError("ProviderResponseInvalid", "素材 AI 必须处理每一条已分析素材。", 422);

  const discoveryAssets = usable.filter((asset) => !unassigned.has(asset.assetId));
  const discoveryStarted = Date.now();
  const opportunities = await provider.discoverOpportunities({ events: clustered.events, assets: discoveryAssets.map(({ assetId, analysis }) => ({ assetId, analysis })), userGoal: goalText });
  await recordUsage({ operation: "CONTENT_DISCOVERY", provider: config.provider, model: config.model, durationMs: Date.now() - discoveryStarted, currencyCost: config.provider === "mock" ? 0 : null });
  for (const item of opportunities) if (item.assetIds.some((id) => !usableIds.has(id) || unassigned.has(id))) throw new WorkflowError("ProviderResponseInvalid", "素材 AI 返回了无效的内容关联。", 422);

  await db.$transaction(async (tx) => {
    await tx.opportunitySegment.deleteMany({ where: { opportunity: { batchId } } });
    await tx.missingMaterialRequest.deleteMany({ where: { opportunity: { batchId } } });
    await tx.contentOpportunity.deleteMany({ where: { batchId } });
    await tx.eventMaterial.deleteMany({ where: { event: { batchId } } });
    await tx.storyEvent.deleteMany({ where: { batchId } });

    const eventAssetIds = new Map<string, Set<string>>();
    for (const event of clustered.events) {
      const saved = await tx.storyEvent.create({ data: { batchId, title: event.title, summary: event.summary, confidence: event.confidence, materials: { create: event.assetIds.map((materialAssetId) => ({ materialAssetId, relevanceScore: event.confidence })) } } });
      eventAssetIds.set(saved.id, new Set(event.assetIds));
    }
    for (const item of opportunities.slice(0, 3)) {
      const analyses = usable.filter((asset) => item.assetIds.includes(asset.assetId)).map((asset) => asset.analysis);
      const coverage = Math.min(100, item.assetIds.length / 3 * 100);
      const narrativeCompleteness = item.assetIds.length >= 2 ? 100 : 50;
      const visualSupport = analyses.length ? analyses.reduce((sum, analysis) => sum + qualityScore(analysis.visualQuality), 0) / analyses.length : 0;
      const score = Math.round(coverage * 0.4 + narrativeCompleteness * 0.35 + visualSupport * 0.25);
      const missing = item.missing || [];
      const ready = item.assetIds.length >= 3 && !missing.length && score >= READY_THRESHOLD;
      const storyEventId = [...eventAssetIds.entries()].find(([, ids]) => item.assetIds.every((id) => ids.has(id)))?.[0] || null;
      await tx.contentOpportunity.create({ data: { batchId, storyEventId, title: item.title, contentType: item.contentType, angle: item.angle, summary: item.summary, hook: item.hook, targetDuration: item.targetDuration, sufficiencyScore: score, status: ready ? "READY" : "NEEDS_MORE_MATERIAL", reason: item.reason, segments: { create: item.assetIds.map((materialAssetId, index) => ({ order: index + 1, materialAssetId, role: index === 0 ? "HOOK" : "DETAIL", description: "使用该素材支撑当前内容结构。" })) }, missingMaterials: { create: missing.map((value, index) => ({ order: index + 1, ...value, required: true })) } } });
    }
  });

  await db.materialBatch.update({ where: { id: batchId }, data: { status: "ANALYZED", analysisCompletedAt: new Date(), errorMessage: refreshed.assets.some((asset) => asset.analysisStatus === "FAILED") ? "部分素材处理失败，可重试后重新整理。" : null } });
  await recordProductEvent({ eventName: AnalyticsEvent.EVENT_CLUSTERING_COMPLETED, eventData: { eventCount: clustered.events.length } });
  await recordProductEvent({ eventName: AnalyticsEvent.CONTENT_DISCOVERY_COMPLETED, eventData: { opportunityCount: opportunities.length } });
  return true;
}
