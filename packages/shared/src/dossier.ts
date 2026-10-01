import { z } from "zod";
import { onChainEventSchema } from "./stage";

export const dossierArtifactSchema = z.strictObject({
  kind: z.enum(["stage", "evidence", "release"]),
  referenceId: z.string(),
  label: z.string(),
  sha256: z.string().nullable(),
  txid: z.string().nullable()
});
export type DossierArtifact = z.infer<typeof dossierArtifactSchema>;

export const DOSSIER_STATUSES = ["compiled", "signed", "rejected"] as const;
export const dossierStatusSchema = z.enum(DOSSIER_STATUSES);
export type DossierStatus = z.infer<typeof dossierStatusSchema>;

export const dossierSchema = z.strictObject({
  id: z.string(),
  unitId: z.string(),
  unitReference: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  masterHash: z.string(),
  compiledAt: z.coerce.date(),
  status: dossierStatusSchema,
  artifacts: z.array(dossierArtifactSchema),
  completeness: z.number().int().min(0).max(100),
  signatureTxid: z.string().nullable(),
  signedAt: z.coerce.date().nullable(),
  rejectionNote: z.string().nullable()
});
export type Dossier = z.infer<typeof dossierSchema>;

export const dossierShareSchema = z.strictObject({
  shareToken: z.string(),
  path: z.string(),
  masterHash: z.string()
});
export type DossierShare = z.infer<typeof dossierShareSchema>;

export const notarySignatureSchema = z.strictObject({
  dossierId: z.string(),
  unitReference: z.string(),
  projectName: z.string(),
  masterHash: z.string(),
  signatureTxid: z.string().nullable(),
  signedAt: z.coerce.date().nullable(),
  status: dossierStatusSchema
});
export type NotarySignature = z.infer<typeof notarySignatureSchema>;

export const rejectDossierSchema = z.strictObject({ note: z.string().min(1).max(2000) });
export type RejectDossierInput = z.infer<typeof rejectDossierSchema>;

export const dossierSignResultSchema = z.strictObject({
  dossierId: z.string(),
  masterHash: z.string(),
  signedAt: z.coerce.date().optional(),
  anchor: onChainEventSchema.optional()
});
export type DossierSignResult = z.infer<typeof dossierSignResultSchema>;

export const dossierRejectResultSchema = z.strictObject({
  dossierId: z.string(),
  status: z.literal("rejected")
});
export type DossierRejectResult = z.infer<typeof dossierRejectResultSchema>;

export const publicDossierSchema = z.strictObject({
  unitReference: z.string(),
  projectName: z.string(),
  masterHash: z.string(),
  compiledAt: z.coerce.date(),
  status: dossierStatusSchema,
  completeness: z.number().int().min(0).max(100),
  signatureTxid: z.string().nullable(),
  signedAt: z.coerce.date().nullable(),
  artifacts: z.array(dossierArtifactSchema)
});
export type PublicDossier = z.infer<typeof publicDossierSchema>;
