import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getMaterialAIProvider } from "../packages/ai/get-material-ai-provider";
import type { CapturedAtReliability, MaterialAnalysisResult } from "../packages/ai/material-ai-provider";

type Source = "MEDIA_METADATA" | "USER_UPLOAD" | "UNKNOWN";
type Sample = { assetId: string; capturedAt: string | null; capturedAtSource: Source; analysis: MaterialAnalysisResult };
type GroundTruth = { contentThreads: string[][]; confirmedEvents: string[][]; ambiguousAssetIds: string[]; noiseAssetIds: string[] };

function reliability(capturedAt: Date | null, source: Source): CapturedAtReliability {
  if (!capturedAt) return "NONE";
  return source === "MEDIA_METADATA" ? "RELIABLE" : source === "USER_UPLOAD" ? "WEAK" : "NONE";
}

function sameSet(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function countMatchingGroups(actual: string[][], expected: string[][]) {
  return expected.filter((group) => actual.some((candidate) => sameSet([...candidate].sort(), [...group].sort()))).length;
}

async function main() {
  const fixtureDir = path.join(process.cwd(), "test-fixtures", "event-benchmark-v2");
  const samples = JSON.parse(await readFile(path.join(fixtureDir, "structured-samples.json"), "utf8")) as Sample[];
  const truth = JSON.parse(await readFile(path.join(fixtureDir, "ground-truth.json"), "utf8")) as GroundTruth;
  const provider = getMaterialAIProvider();
  const startedAt = Date.now();
  const result = await provider.clusterEvents({ assets: samples.map((sample) => {
    const capturedAt = sample.capturedAt ? new Date(sample.capturedAt) : null;
    return { assetId: sample.assetId, capturedAt, capturedAtSource: sample.capturedAtSource, capturedAtReliability: reliability(capturedAt, sample.capturedAtSource), analysis: sample.analysis };
  }) });
  const threadGroups = result.contentThreads.map((thread) => thread.assetIds);
  const eventGroups = result.events.map((event) => event.assetIds);
  const ambiguousInEvent = truth.ambiguousAssetIds.filter((id) => eventGroups.some((group) => group.includes(id)));
  const eventNoise = truth.noiseAssetIds.filter((id) => eventGroups.some((group) => group.includes(id)));
  const unassignedNoise = truth.noiseAssetIds.filter((id) => result.unassignedAssetIds.includes(id));
  const summary = {
    durationMs: Date.now() - startedAt,
    contentThreadGroupsMatched: countMatchingGroups(threadGroups, truth.contentThreads),
    contentThreadGroupTotal: truth.contentThreads.length,
    confirmedEventGroupsMatched: countMatchingGroups(eventGroups, truth.confirmedEvents),
    confirmedEventGroupTotal: truth.confirmedEvents.length,
    ambiguousAssetsInConfirmedEvents: ambiguousInEvent,
    noiseAssetsInConfirmedEvents: eventNoise,
    noiseAssetsUnassigned: unassignedNoise,
  };
  const output = { summary, result };
  const outputDir = path.join(process.cwd(), "test-results", "event-benchmark-v2");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "result.json"), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(summary));
}

void main();
