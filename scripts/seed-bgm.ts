import "dotenv/config";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/db";
import { ffmpegBinary, runVideoCommand } from "../lib/video";

const tracks = [["轻松", "light", 220], ["温暖", "warm", 261], ["节奏感", "rhythm", 329]] as const;
async function main() { const root = path.resolve(process.env.STORAGE_ROOT || "storage", "bgm"); await mkdir(root, { recursive: true }); for (const [name, id, hz] of tracks) { const file = path.join(root, `${id}.mp3`); try { await runVideoCommand(ffmpegBinary(), ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=${hz}:sample_rate=48000`, "-t", "12", "-c:a", "libmp3lame", "-q:a", "5", file]); } catch { /* existing seed file is sufficient */ } await db.bgmTrack.upsert({ where: { storageKey: `bgm/${id}.mp3` }, create: { name, fileUrl: `/api/files/bgm/${id}.mp3`, storageKey: `bgm/${id}.mp3`, duration: 12, category: name, licenseNote: "Internal test track generated for this project; no third-party music.", active: true }, update: { active: true } }); } await db.$disconnect(); }
void main();
