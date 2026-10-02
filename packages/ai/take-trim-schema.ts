import { z } from "zod";

export const takeTrimSchema = z.object({
  startTime: z.number().finite().min(0),
  endTime: z.number().finite().gt(0),
  confidence: z.number().finite().min(0).max(1),
  reason: z.string().trim().min(1).max(1000),
  actionStartTime: z.number().finite().min(0),
  actionEndTime: z.number().finite().min(0),
});

export const takeTrimJsonSchema = {
  type: "object", additionalProperties: false,
  required: ["startTime", "endTime", "confidence", "reason", "actionStartTime", "actionEndTime"],
  properties: {
    startTime: { type: "number", minimum: 0 }, endTime: { type: "number", exclusiveMinimum: 0 },
    confidence: { type: "number", minimum: 0, maximum: 1 }, reason: { type: "string", minLength: 1, maxLength: 1000 },
    actionStartTime: { type: "number", minimum: 0 }, actionEndTime: { type: "number", minimum: 0 },
  },
} as const;
