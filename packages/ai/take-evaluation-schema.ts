import { z } from "zod";
import { criticalIssueValues, type TakeEvaluation } from "./types";

const score = z.number().int().min(0).max(100);

const takeEvaluationSchema = z.object({
  passed: z.boolean(),
  overallScore: score,
  dimensions: z.object({
    framing: score,
    action: score,
    movement: score,
    timing: score,
    visibility: score,
  }).strict(),
  criticalIssues: z.array(z.enum(criticalIssueValues)).max(6),
  mainIssue: z.string().trim().max(200),
  advice: z.string().trim().max(300),
  confidence: z.number().min(0).max(1),
  evidence: z.string().trim().max(500),
  issueStartTime: z.number().min(-1),
  issueEndTime: z.number().min(-1),
}).strict();

export const takeEvaluationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["passed", "overallScore", "dimensions", "criticalIssues", "mainIssue", "advice", "confidence", "evidence", "issueStartTime", "issueEndTime"],
  properties: {
    passed: { type: "boolean" },
    overallScore: { type: "integer", minimum: 0, maximum: 100 },
    dimensions: {
      type: "object",
      additionalProperties: false,
      required: ["framing", "action", "movement", "timing", "visibility"],
      properties: {
        framing: { type: "integer", minimum: 0, maximum: 100 },
        action: { type: "integer", minimum: 0, maximum: 100 },
        movement: { type: "integer", minimum: 0, maximum: 100 },
        timing: { type: "integer", minimum: 0, maximum: 100 },
        visibility: { type: "integer", minimum: 0, maximum: 100 },
      },
    },
    criticalIssues: { type: "array", maxItems: 6, uniqueItems: true, items: { type: "string", enum: criticalIssueValues } },
    mainIssue: { type: "string", maxLength: 200 },
    advice: { type: "string", maxLength: 300 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "string", maxLength: 500 },
    issueStartTime: { type: "number", minimum: -1 },
    issueEndTime: { type: "number", minimum: -1 },
  },
} as const;

export function parseTakeEvaluation(value: unknown): TakeEvaluation {
  const parsed = takeEvaluationSchema.parse(value);
  const mainIssue = parsed.mainIssue || null;
  const evidence = parsed.evidence || null;
  const issueStartTime = parsed.issueStartTime < 0 ? null : parsed.issueStartTime;
  const issueEndTime = parsed.issueEndTime < 0 ? null : parsed.issueEndTime;
  return { ...parsed, mainIssue, evidence, issueStartTime, issueEndTime };
}
