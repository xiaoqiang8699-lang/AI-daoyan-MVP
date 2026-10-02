import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

export const runtime = "nodejs";

const files = { "full-take": "full-take-ab.mp4", "smart-trim": "smart-trim-ab.mp4" } as const;

export async function GET(request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const name = files[(await params).variant as keyof typeof files];
  if (!name) return new Response(null, { status: 404 });
  const filePath = path.resolve("test-results", "trim-benchmark", name);
  const file = await stat(filePath);
  const range = request.headers.get("range");
  let start = 0; let end = file.size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
    start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]));
    if (match[2]) end = Math.min(end, Number(match[2]));
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= file.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
  }
  return new Response(Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream, {
    status: range ? 206 : 200,
    headers: { "Content-Type": "video/mp4", "Content-Length": String(end - start + 1), "Content-Range": range ? `bytes ${start}-${end}/${file.size}` : "", "Accept-Ranges": "bytes", "Content-Disposition": `inline; filename=\"${name}\"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
