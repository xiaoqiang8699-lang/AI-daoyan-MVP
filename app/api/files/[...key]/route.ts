import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { getStorageProvider } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const parts = (await params).key;
    const key = parts.join("/");
    const owned = parts[0] === "materials"
      ? await db.materialBatch.findFirst({ where: { id: parts[1], userId: DEMO_USER_ID }, select: { id: true } })
      : await db.project.findFirst({ where: { id: parts[1], userId: DEMO_USER_ID }, select: { id: true } });
    if (!owned) return new Response(null, { status: 404 });
    const file = await getStorageProvider().getLocalFile(key);
    const extension = key.split(".").pop();
    const contentType = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : extension === "mov" ? "video/quicktime" : extension === "webm" ? "video/webm" : "video/mp4";
    const headers: Record<string, string> = { "Content-Type": contentType, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" };
    const range = request.headers.get("range");
    let start = 0;
    let end = file.size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
      if (!match[1]) start = Math.max(0, file.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= file.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
      headers["Content-Range"] = `bytes ${start}-${end}/${file.size}`;
    }
    headers["Content-Length"] = String(end - start + 1);
    return new Response(Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream, { status: range ? 206 : 200, headers });
  } catch { return new Response(null, { status: 404 }); }
}
