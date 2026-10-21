import { z } from "zod";
import { dateTimeSchema, idSchema } from "./common.js";

export const severitySchema = z.enum(["low", "medium", "high"]);
export type Severity = z.infer<typeof severitySchema>;

export const anomalySchema = z.object({
  id: idSchema,
  petId: idSchema,
  /** Only 'weight' for now. */
  kind: z.string(),
  severity: severitySchema,
  confidence: z.number().min(0).max(1).nullable(),
  details: z.string().nullable(),
  detectedAt: dateTimeSchema,
});
export type Anomaly = z.infer<typeof anomalySchema>;

/** Pre-consultation summary produced by the AI module. */
export const visitSummarySchema = z.object({
  petId: idSchema,
  summary: z.string(),
  keyPoints: z.array(z.string()),
  generatedAt: dateTimeSchema,
});
export type VisitSummary = z.infer<typeof visitSummarySchema>;
