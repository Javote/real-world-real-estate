import { z } from "zod";
import { cuidParamSchema } from "./params";

// SPEC-502: el desacuerdo entre las partes de un stage. Nunca se ancla ni mueve valor (D-021).

export const DISPUTE_STATUSES = ["Open", "Resolved"] as const;
export const disputeStatusSchema = z.enum(DISPUTE_STATUSES);
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;

/** Cerrado, no texto libre: `disputeRate` y el reporte del milestone distinguen el desenlace. */
export const DISPUTE_OUTCOMES = ["ReInspectionAgreed", "RefundAgreed", "Dismissed"] as const;
export const disputeOutcomeSchema = z.enum(DISPUTE_OUTCOMES);
export type DisputeOutcome = z.infer<typeof disputeOutcomeSchema>;

const textoLibre = z.string().trim().min(1).max(2000);

export const openDisputeSchema = z.strictObject({
  stageId: cuidParamSchema,
  reason: textoLibre
});
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;

export const resolveDisputeSchema = z.strictObject({
  resolution: textoLibre,
  outcome: disputeOutcomeSchema
});
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export const listDisputesQuerySchema = z.strictObject({
  projectId: cuidParamSchema,
  status: disputeStatusSchema.optional()
});
export type ListDisputesQuery = z.infer<typeof listDisputesQuerySchema>;

export const disputeSchema = z.strictObject({
  id: z.string(),
  stageId: z.string(),
  projectId: z.string(),
  openedById: z.string(),
  reason: z.string(),
  status: disputeStatusSchema,
  outcome: disputeOutcomeSchema.nullable(),
  resolution: z.string().nullable(),
  resolvedById: z.string().nullable(),
  createdAt: z.coerce.date(),
  resolvedAt: z.coerce.date().nullable()
});
export type Dispute = z.infer<typeof disputeSchema>;
