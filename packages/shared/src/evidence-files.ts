import { z } from "zod";
import { EVIDENCE_REJECTION_CODES } from "./evidence-rules";

export const evidenceRejectionCodeSchema = z.enum(EVIDENCE_REJECTION_CODES);

export const evidenceRejectionSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  code: evidenceRejectionCodeSchema
});
export type EvidenceRejection = z.infer<typeof evidenceRejectionSchema>;
