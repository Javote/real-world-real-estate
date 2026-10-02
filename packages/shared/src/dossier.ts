import { z } from "zod";
import { sha256HexSchema, txidSchema } from "./hashes";
import { onChainEventSchema } from "./stage";

export const dossierArtifactSchema = z.strictObject({
  kind: z.enum(["stage", "evidence", "release"]),
  referenceId: z.string(),
  label: z.string(),
  sha256: sha256HexSchema.nullable(),
  txid: txidSchema.nullable()
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
  masterHash: sha256HexSchema,
  compiledAt: z.coerce.date(),
  status: dossierStatusSchema,
  artifacts: z.array(dossierArtifactSchema),
  completeness: z.number().int().min(0).max(100),
  signatureTxid: txidSchema.nullable(),
  signedAt: z.coerce.date().nullable(),
  rejectionNote: z.string().nullable()
});
export type Dossier = z.infer<typeof dossierSchema>;

export const dossierShareSchema = z.strictObject({
  shareToken: z.string(),
  path: z.string(),
  masterHash: sha256HexSchema
});
export type DossierShare = z.infer<typeof dossierShareSchema>;

export const notarySignatureSchema = z.strictObject({
  dossierId: z.string(),
  unitReference: z.string(),
  projectName: z.string(),
  masterHash: sha256HexSchema,
  signatureTxid: txidSchema.nullable(),
  signedAt: z.coerce.date().nullable(),
  status: dossierStatusSchema
});
export type NotarySignature = z.infer<typeof notarySignatureSchema>;

export const rejectDossierSchema = z.strictObject({ note: z.string().min(1).max(2000) });
export type RejectDossierInput = z.infer<typeof rejectDossierSchema>;

export const dossierSignResultSchema = z.strictObject({
  dossierId: z.string(),
  masterHash: sha256HexSchema,
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
  masterHash: sha256HexSchema,
  compiledAt: z.coerce.date(),
  status: dossierStatusSchema,
  completeness: z.number().int().min(0).max(100),
  signatureTxid: txidSchema.nullable(),
  signedAt: z.coerce.date().nullable(),
  artifacts: z.array(dossierArtifactSchema)
});
export type PublicDossier = z.infer<typeof publicDossierSchema>;
