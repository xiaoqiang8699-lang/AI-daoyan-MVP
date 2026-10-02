import { WorkflowError } from "./errors";

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || request.headers.get("host");
  let originHost: string | null = null;
  try { originHost = origin ? new URL(origin).host : null; } catch { /* rejected below */ }
  if (request.headers.get("sec-fetch-site") === "cross-site" || !originHost || !host || originHost !== host) {
    throw new WorkflowError("INVALID_ORIGIN", "请求来源无效，请从本站重新操作。", 403);
  }
}
