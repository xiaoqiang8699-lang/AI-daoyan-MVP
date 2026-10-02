import "dotenv/config";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/db";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const base = "https://localhost:3010";
const timeline: Record<string, string> = {};
async function request(url: string, init: RequestInit) {
  const response = await fetch(`${base}${url}`, { ...init, headers: { Origin: base, Host: "localhost:3010", ...(init.headers || {}) } });
  const data = await response.json(); if (!response.ok) throw new Error(`${response.status}: ${data.error}`); return data;
}
async function main() {
  timeline.batchCreated = new Date().toISOString();
  const batch = await request("/api/material-batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  for (const [directory, name, mime] of [["step10b-smoke", "a-unbox.png", "image/png"], ["step10b-smoke", "b-cardigan.png", "image/png"], ["step10b-smoke", "c-rack.png", "image/png"], ["step10b-e2e", "blue-action.mp4", "video/mp4"]] as const) {
    const bytes = await readFile(path.join("test-fixtures", directory, name));
    await request(`/api/material-batches/${batch.id}/assets`, { method: "POST", headers: { "Content-Type": mime, "X-File-Name": encodeURIComponent(name), "X-File-Size": String(bytes.length) }, body: bytes });
  }
  timeline.uploadCompleted = new Date().toISOString();
  await request(`/api/material-batches/${batch.id}/analyze`, { method: "POST" }); timeline.analysisRequested = new Date().toISOString();
  const deadline = Date.now() + 30_000; let materialBatch;
  do { await new Promise((resolve) => setTimeout(resolve, 250)); materialBatch = await db.materialBatch.findUnique({ where: { id: batch.id }, include: { assets: { include: { analysis: true } }, events: true, opportunities: true } }); } while (materialBatch?.status === "ANALYZING" && Date.now() < deadline);
  if (!materialBatch || materialBatch.status !== "ANALYZED") throw new Error(`worker did not complete: ${materialBatch?.status || "missing"}`);
  const result = { batchId: batch.id, timeline: { ...timeline, analysisCompleted: materialBatch.analysisCompletedAt?.toISOString() || null }, status: materialBatch.status, assetCount: materialBatch.assets.length, analyzedAssets: materialBatch.assets.filter((asset) => asset.analysisStatus === "ANALYZED").length, eventCount: materialBatch.events.length, opportunityCount: materialBatch.opportunities.length };
  await mkdir(path.join("test-results", "step10b-benchmark"), { recursive: true }); await writeFile(path.join("test-results", "step10b-benchmark", "worker-e2e.json"), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
}
void main().finally(() => db.$disconnect());
