import { z } from "zod";
import { evidenceRejectionSchema } from "./evidence-files";
import { EVIDENCE_MAX_FILES } from "./evidence-rules";
import { sha256HexSchema, txidSchema } from "./hashes";
import type { MerkleStep } from "./merkle";
import { onChainEventSchema, onChainEventStatusSchema } from "./stage";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

export const EVIDENCE_TYPES = ["document", "photo", "certificate"] as const;
export const evidenceTypeSchema = z.enum(EVIDENCE_TYPES);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

const MULTIPART_BOOLEAN_TRUE = new Set(["true", "on", "1"]);
const MULTIPART_BOOLEAN_FALSE = new Set(["false", "off", "0", ""]);

const multipartBooleanSchema = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return false;
    const normalizado = v.toLowerCase();
    if (MULTIPART_BOOLEAN_TRUE.has(normalizado)) return true;
    if (MULTIPART_BOOLEAN_FALSE.has(normalizado)) return false;
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor booleano no reconocido" });
    return z.NEVER;
  });

export const stageEvidenceUploadSchema = z.object({
  evidenceType: evidenceTypeSchema,
  category: z.string().min(1),
  description: z.string().max(2000).optional(),
  authoritative: multipartBooleanSchema,
  issuingAuthority: z
    .string()
    .max(200)
    .optional()
    .transform((v) => v?.trim() || null)
});
export type StageEvidenceUploadInput = z.infer<typeof stageEvidenceUploadSchema>;

export const EVIDENCE_UNATTRIBUTED = "EVIDENCE_UNATTRIBUTED" as const;

/**
 * Evidencia sin firmar (D-028): declarada `authoritative` sin decir qué autoridad la emitió.
 * La rechazan el upload y el `PATCH`; la transición a `Completed` la sigue frenando por las
 * filas anteriores.
 */
export function evidenciaSinAtribuir(evidencia: {
  authoritative: boolean;
  issuingAuthority: string | null | undefined;
}): boolean {
  return evidencia.authoritative && !evidencia.issuingAuthority?.trim();
}

export const evidenceSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  stageId: z.string().nullable(),
  uploadedById: z.string(),
  evidenceType: evidenceTypeSchema,
  category: z.string(),
  authoritative: z.boolean(),
  originalFilename: z.string(),
  storedFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256Hash: sha256HexSchema,
  uploadedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type EvidenceResponse = z.infer<typeof evidenceSchema>;

export const stageEvidenceSummarySchema = z.strictObject({
  id: z.string(),
  evidenceType: evidenceTypeSchema,
  category: z.string(),
  authoritative: z.boolean(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256Hash: sha256HexSchema,
  uploadedAt: z.coerce.date()
});
export type StageEvidenceSummary = z.infer<typeof stageEvidenceSummarySchema>;

export const updateEvidenceSchema = z.object({
  category: z.string().min(1).optional(),
  authoritative: z.boolean().optional(),
  issuingAuthority: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v?.trim() || null)),
  evidenceType: evidenceTypeSchema.optional(),
  stageId: z.string().nullable().optional()
});
export type UpdateEvidenceInput = z.infer<typeof updateEvidenceSchema>;

export const anchorDocumentSchema = z.strictObject({ evidenceId: z.string().min(1) });
export type AnchorDocumentInput = z.infer<typeof anchorDocumentSchema>;

export const developerDocumentListQuerySchema = z.object({
  status: z.enum(["anchored", "pending"]).optional()
});
export type DeveloperDocumentListQuery = z.infer<typeof developerDocumentListQuerySchema>;

export const projectDocumentSchema = z.strictObject({
  id: z.string(),
  stageId: z.string().nullable(),
  evidenceType: evidenceTypeSchema,
  category: z.string(),
  authoritative: z.boolean(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256Hash: sha256HexSchema,
  uploadedAt: z.coerce.date(),
  txid: txidSchema.nullable(),
  anchorStatus: onChainEventStatusSchema
});
export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

export const developerDocumentSchema = z.strictObject({
  id: z.string(),
  filename: z.string(),
  category: z.string(),
  authoritative: z.boolean(),
  sha256Hash: sha256HexSchema.nullable(),
  uploadedAt: z.coerce.date(),
  txid: txidSchema.nullable(),
  anchorStatus: onChainEventStatusSchema.nullable()
});
export type DeveloperDocument = z.infer<typeof developerDocumentSchema>;

export const merkleStepSchema = z.strictObject({
  sibling: sha256HexSchema,
  position: z.enum(["left", "right"])
});
const _merkleStepSchemaMatchesInterface: Equal<z.infer<typeof merkleStepSchema>, MerkleStep> = true;
void _merkleStepSchemaMatchesInterface;

export const evidenceProofSchema = z.strictObject({
  merkleRoot: sha256HexSchema,
  leaf: sha256HexSchema,
  proof: z.array(merkleStepSchema),
  signerUserId: z.string(),
  anchorStatus: z.string().nullable(),
  txid: txidSchema.nullable(),
  timestamp: z.iso.datetime().nullable()
});
export type EvidenceProof = z.infer<typeof evidenceProofSchema>;

export const bundleFilesSchema = z.strictObject({
  bundleId: z.string(),
  merkleRoot: sha256HexSchema,
  files: z.array(
    z.strictObject({
      evidenceId: z.string(),
      sha256Hash: sha256HexSchema,
      filename: z.string().nullable()
    })
  )
});
export type BundleFiles = z.infer<typeof bundleFilesSchema>;

export const stageEvidenceUploadResultSchema = z.strictObject({
  evidences: z.array(evidenceSchema).min(1).max(EVIDENCE_MAX_FILES),
  rejected: z.array(evidenceRejectionSchema).max(EVIDENCE_MAX_FILES),
  bundleId: z.string(),
  merkleRoot: sha256HexSchema,
  anchor: onChainEventSchema
});
export type StageEvidenceUploadResult = z.infer<typeof stageEvidenceUploadResultSchema>;
