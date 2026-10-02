import { z } from "zod";
import { sha256HexSchema, txidSchema } from "./hashes";
import { invitationStatusSchema } from "./invitation";
import { onChainEventStatusSchema, stageStateSchema } from "./stage";

export const certifierEvidenceSchema = z.strictObject({
  id: z.string(),
  originalFilename: z.string(),
  category: z.string(),
  authoritative: z.boolean(),
  sha256Hash: sha256HexSchema.nullable(),
  uploadedAt: z.coerce.date()
});
export type CertifierEvidence = z.infer<typeof certifierEvidenceSchema>;

export const certifierStageViewSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  sequenceOrder: z.number().int().positive(),
  state: stageStateSchema,
  validationCritical: z.boolean(),
  projectId: z.string(),
  projectName: z.string(),
  evidence: z.array(certifierEvidenceSchema)
});
export type CertifierStageView = z.infer<typeof certifierStageViewSchema>;

export const certifierCertificateSchema = z.strictObject({
  stageId: z.string(),
  stageName: z.string(),
  projectName: z.string(),
  certifiedAt: z.coerce.date().nullable(),
  commitmentHash: sha256HexSchema.nullable(),
  txid: txidSchema.nullable(),
  anchorStatus: onChainEventStatusSchema.nullable()
});
export type CertifierCertificate = z.infer<typeof certifierCertificateSchema>;

export const inviteCertifierSchema = z.strictObject({
  certifierId: z.string().min(1)
});
export type InviteCertifierInput = z.infer<typeof inviteCertifierSchema>;

export const certifierInvitationSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  certifierId: z.string(),
  certifierName: z.string(),
  status: invitationStatusSchema,
  createdAt: z.coerce.date(),
  respondedAt: z.coerce.date().nullable()
});
export type CertifierInvitation = z.infer<typeof certifierInvitationSchema>;
