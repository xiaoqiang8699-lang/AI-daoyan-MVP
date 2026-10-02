import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { KieEnhancementProvider } from "../packages/ai/providers/kie-enhancement-provider";
import { probeVideo } from "../lib/video";
import { validateTranscript } from "../lib/enhancement";

const root = path.resolve("test-results/step8-benchmark");
async function main() { const apiKey = process.env.KIE_API_KEY; if (!apiKey) throw new Error("KIE_API_KEY is required"); await mkdir(root, { recursive: true }); const provider = new KieEnhancementProvider({ apiKey, model: process.env.KIE_VIDEO_MODEL || "gemini-3-8-flash", uploadAuditPath: path.join(root, "upload-audit.jsonl") }); const audio = path.join(root, "stt-anonymous.mp3"); const video = path.join(root, "final-qa-anonymous.mp4"); const [audioInfo, videoInfo] = await Promise.all([probeVideo(audio, "mp4").catch(() => ({ duration: 1.5 })), probeVideo(video, "mp4")]); const started = Date.now(); const transcript = process.env.STEP8_ONLY === "qa" ? null : await provider.transcribe({ localFilePath: audio, mimeType: "audio/mpeg", duration: audioInfo.duration }); if (transcript) await writeFile(path.join(root, "transcript.json"), JSON.stringify({ ...transcript, segments: validateTranscript(transcript.segments, audioInfo.duration) }, null, 2)); if (process.env.STEP8_ONLY === "stt") return; const qa = await provider.evaluateFinalVideo({ localFilePath: video, mimeType: "video/mp4", duration: videoInfo.duration, subtitleEnabled: false }); await writeFile(path.join(root, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), transcript: transcript ? { ...transcript, segments: validateTranscript(transcript.segments, audioInfo.duration) } : null, qa, durationMs: Date.now() - started, privacy: { identifiablePerson: false, originalAudio: false, originalFinalVideo: false, deletionStatus: "NOT_SUPPORTED", potentialRetention: "up to 3 days" } }, null, 2)); }
void main();
