import "server-only";
import { db } from "./db";
import { DEMO_USER_ID } from "./demo-user";
import type { AnalyticsEventName } from "./analytics-events";

type SafeData = Record<string, string | number | boolean | null>;
function safeData(value?: SafeData) { return value && Object.keys(value).length ? value : undefined; }

export async function recordProductEvent(input: { eventName: AnalyticsEventName; projectId?: string | null; sessionId?: string | null; eventData?: SafeData }) {
  let sessionId = input.sessionId || null;
  if (!sessionId && input.projectId) sessionId = (await db.userTestSession.findUnique({ where: { projectId: input.projectId }, select: { id: true } }))?.id || null;
  return db.productEvent.create({ data: { userId: DEMO_USER_ID, projectId: input.projectId || null, sessionId, eventName: input.eventName, eventData: safeData(input.eventData) } });
}

export async function recordUsage(input: { projectId?: string | null; operation: string; provider: string; model?: string | null; inputUnits?: number | null; outputUnits?: number | null; credits?: number | null; currencyCost?: number | null; durationMs?: number | null }) {
  return db.usageLedger.create({ data: { userId: DEMO_USER_ID, projectId: input.projectId || null, operation: input.operation, provider: input.provider, model: input.model || null, inputUnits: input.inputUnits ?? null, outputUnits: input.outputUnits ?? null, credits: input.credits ?? null, currencyCost: input.currencyCost ?? null, durationMs: input.durationMs ?? null } });
}
