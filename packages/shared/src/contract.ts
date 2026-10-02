import { z } from "zod";
import { sha256HexSchema, txidSchema } from "./hashes";
import { onChainEventSchema, onChainEventStatusSchema } from "./stage";
import { unitStatusSchema } from "./unit";

export const releasePaymentSchema = z.strictObject({
  amountMinorUnits: z.number().int().positive()
});
export type ReleasePaymentInput = z.infer<typeof releasePaymentSchema>;

export const RELEASE_EXCEEDS_CONTRACT = "RELEASE_EXCEEDS_CONTRACT";

export const developerContractSchema = z.strictObject({
  id: z.string(),
  totalMinorUnits: z.number().int().positive(),
  currency: z.string(),
  signedAt: z.number().nullable(),
  unitId: z.string(),
  unitReference: z.string(),
  unitStatus: unitStatusSchema,
  investorName: z.string(),
  txid: txidSchema.nullable(),
  commitment: sha256HexSchema.nullable()
});
export type DeveloperContract = z.infer<typeof developerContractSchema>;

export const paymentAttestationSchema = z.strictObject({
  id: z.string(),
  contractId: z.string(),
  stageNumber: z.number().int().positive(),
  amountMinorUnits: z.number().int().positive(),
  releasedById: z.string().nullable(),
  releasedAt: z.number()
});
export type PaymentAttestationResponse = z.infer<typeof paymentAttestationSchema>;

export const paymentReleaseResultSchema = paymentAttestationSchema.extend({
  anchor: onChainEventSchema
});
export type PaymentReleaseResult = z.infer<typeof paymentReleaseResultSchema>;

export const contractSchema = z.strictObject({
  id: z.string(),
  unitId: z.string(),
  investorId: z.string(),
  totalMinorUnits: z.number().int().positive(),
  currency: z.string(),
  signedAt: z.number().nullable(),
  createdAt: z.coerce.date()
});
export type ContractResponse = z.infer<typeof contractSchema>;

export const acceptInvitationResultSchema = z.strictObject({
  contract: contractSchema,
  anchor: onChainEventSchema
});
export type AcceptInvitationResult = z.infer<typeof acceptInvitationResultSchema>;

export const investorContractSchema = z.strictObject({
  id: z.string(),
  totalMinorUnits: z.number().int().positive(),
  currency: z.string(),
  signedAt: z.number().nullable(),
  investorId: z.string(),
  unitReference: z.string()
});
export type InvestorContract = z.infer<typeof investorContractSchema>;

export const contractReleaseSchema = z.strictObject({
  id: z.string(),
  stageNumber: z.number().int().positive(),
  amountMinorUnits: z.number().int().positive(),
  releasedAt: z.number(),
  commitment: sha256HexSchema.nullable(),
  txid: txidSchema.nullable(),
  anchorStatus: onChainEventStatusSchema.nullable()
});
export type ContractRelease = z.infer<typeof contractReleaseSchema>;
