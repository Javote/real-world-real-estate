import { z } from "zod";

// La documentación de respaldo del developer (M2-D5 filas 46-47) — **M3-BE-14**.
//
// Es la misma `Evidence` que sube el flujo de etapas, vista desde el ángulo del
// developer: qué documentos del proyecto están anclados y cuáles todavía no.

/** Espeja `Evidence.evidenceType` en la migración. */
export const EVIDENCE_TYPES = ["document", "photo", "certificate"] as const;
export const evidenceTypeSchema = z.enum(EVIDENCE_TYPES);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

/**
 * Body de `POST /developer/projects/:id/stages/:stageId/evidence` (fila 38,
 * 44c) — el multipart llega con el archivo aparte (`req.file`, Multer); esto
 * valida los demás campos, que Express entrega como string.
 */
export const stageEvidenceUploadSchema = z.object({
  evidenceType: evidenceTypeSchema,
  category: z.string().min(1),
  description: z.string().max(2000).optional(),
  authoritative: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  /**
   * Declaración de origen (D-028 (a)). Va vacía salvo que se declare
   * autoritativa, y se guarda `null` en vez de "" para que el guard de la
   * transición tenga un solo estado de "falta".
   */
  issuingAuthority: z
    .string()
    .max(200)
    .optional()
    .transform((v) => v?.trim() || null)
});
export type StageEvidenceUploadInput = z.infer<typeof stageEvidenceUploadSchema>;

/** Body de `PATCH /api/v1/evidence/:id`. */
export const updateEvidenceSchema = z.object({
  category: z.string().min(1).optional(),
  authoritative: z.boolean().optional(),
  evidenceType: evidenceTypeSchema.optional(),
  stageId: z.string().nullable().optional()
});
export type UpdateEvidenceInput = z.infer<typeof updateEvidenceSchema>;

/** Body de `POST /developer/documents` — anclar un documento suelto (M3-BE-14). */
export const anchorDocumentSchema = z.strictObject({ evidenceId: z.string().min(1) });
export type AnchorDocumentInput = z.infer<typeof anchorDocumentSchema>;

/** Filtro de `GET /developer/documents` (fila 46-47). */
export const developerDocumentListQuerySchema = z.object({
  status: z.enum(["anchored", "pending"]).optional()
});
export type DeveloperDocumentListQuery = z.infer<typeof developerDocumentListQuerySchema>;

/** Fila 46-47 — un documento del proyecto, con su huella y su prueba. */
export const developerDocumentSchema = z.strictObject({
  id: z.string(),
  filename: z.string(),
  category: z.string(),
  /**
   * Declara provenir de una autoridad externa (D-028). No afirma que la
   * autoridad lo haya emitido: solo que así fue declarado.
   */
  authoritative: z.coerce.boolean(),
  sha256Hash: z.string().nullable(),
  uploadedAt: z.coerce.date(),
  /** **La única fuente del estado**: `null` ⇒ "Pendiente", nunca "Verificado" (regla 17). */
  txid: z.string().nullable(),
  anchorStatus: z.string().nullable()
});
export type DeveloperDocument = z.infer<typeof developerDocumentSchema>;

/** Un paso del camino de Merkle: con qué hermano combinar y de qué lado. */
export const merkleStepSchema = z.strictObject({
  sibling: z.string(),
  position: z.enum(["left", "right"])
});

/**
 * El proof object de `GET /evidence/:bundleId/proof/:fileHash` (M3 §2 —
 * "API returns proof objects: hash + timestamp + signer"). El revisor
 * rehashea su archivo, camina `proof` con `merkleRootFromProof` y compara
 * contra `merkleRoot`.
 *
 * `signerUserId` es quien subió el archivo (`Evidence.uploadedById`): la
 * cuarta afirmación que la plataforma puede sostener — "esta persona
 * atestiguó haberlo revisado" — no que la firma sea criptográfica.
 * `timestamp`/`txid` viajan `null` hasta que el anclaje esté `Confirmed`
 * (regla 17: sin TXID, el estado es "Pendiente", nunca "Verificado").
 */
export const evidenceProofSchema = z.strictObject({
  merkleRoot: z.string(),
  leaf: z.string(),
  proof: z.array(merkleStepSchema),
  signerUserId: z.string(),
  anchorStatus: z.string().nullable(),
  txid: z.string().nullable(),
  timestamp: z.string().datetime().nullable()
});
export type EvidenceProof = z.infer<typeof evidenceProofSchema>;
