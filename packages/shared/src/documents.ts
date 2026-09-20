import { z } from "zod";
import type { MerkleStep } from "./merkle";
import { onChainEventSchema } from "./stage";

/** `true` solo si `A` y `B` son estructuralmente idénticos, en las dos direcciones. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// La documentación de respaldo del developer (M2-D5 filas 46-47) — **M3-BE-14**.
//
// Es la misma `Evidence` que sube el flujo de etapas, vista desde el ángulo del
// developer: qué documentos del proyecto están anclados y cuáles todavía no.

/** Espeja `Evidence.evidenceType` en la migración. */
export const EVIDENCE_TYPES = ["document", "photo", "certificate"] as const;
export const evidenceTypeSchema = z.enum(EVIDENCE_TYPES);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

const MULTIPART_BOOLEAN_TRUE = new Set(["true", "on", "1"]);
const MULTIPART_BOOLEAN_FALSE = new Set(["false", "off", "0", ""]);

/**
 * Un booleano de un `<form>` HTML real, no un JSON: sin distinguir mayúsculas,
 * y sin default silencioso ante un valor desconocido (regla 6) — un checkbox
 * sin `value` manda `"on"`, y "true"/"on"/"1" son los tres que un formulario
 * produce de verdad. Ausente sigue siendo `false`: no declarar nada es no
 * declarar nada (SPEC-403).
 */
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

/**
 * Body de `POST /developer/projects/:id/stages/:stageId/evidence` (fila 38,
 * 44c) — el multipart llega con el archivo aparte (`req.file`, Multer); esto
 * valida los demás campos, que Express entrega como string.
 */
export const stageEvidenceUploadSchema = z.object({
  evidenceType: evidenceTypeSchema,
  category: z.string().min(1),
  description: z.string().max(2000).optional(),
  authoritative: multipartBooleanSchema,
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

/**
 * La fila de `Evidence` tal como puede salir al cliente — mismas columnas que
 * `EVIDENCE_SAFE_COLUMNS` (`apps/api/src/routes/_shared.ts`), **nunca**
 * `storagePath` (D-011: incidente real de filtración de la ruta absoluta en
 * disco del servidor) y sin `issuingAuthority` (esa declaración solo se lee
 * puertas adentro, para el chequeo de `STAGE_EVIDENCE_UNATTRIBUTED`; ningún
 * endpoint la devuelve hoy). Las dos listas — esta y `EVIDENCE_SAFE_COLUMNS`
 * — tienen que seguir coincidiendo: si una columna nueva de `Evidence` se
 * suma a una y no a la otra, o el `select` la esconde sin que el schema lo
 * sepa, o el schema promete un campo que el `select` nunca trajo.
 */
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
  sha256Hash: z.string(),
  uploadedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type EvidenceResponse = z.infer<typeof evidenceSchema>;

/**
 * Evidencia proyectada, embebida en `GET /projects/:id/stages/:stageId`. Sin
 * `projectId`/`stageId`/`uploadedById`/`storedFilename`/`createdAt`/
 * `updatedAt`: el handler no los selecciona (y sin `storagePath`, D-011).
 */
export const stageEvidenceSummarySchema = z.strictObject({
  id: z.string(),
  evidenceType: evidenceTypeSchema,
  category: z.string(),
  authoritative: z.boolean(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256Hash: z.string(),
  uploadedAt: z.coerce.date()
});
export type StageEvidenceSummary = z.infer<typeof stageEvidenceSummarySchema>;

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

/**
 * Fila 06-07 — `GET /projects/:id/documents` (`INV-PROJECT-DOCS-002`). Distinta
 * de `developerDocumentSchema`: esta trae `stageId`/`evidenceType`/`category`
 * (que el `DocumentCard` del developer no pide) y no tiene `filename`
 * (`originalFilename`, sin renombrar) — dos endpoints que documentan la misma
 * evidencia para dos pantallas no comparten la forma solo porque comparten la
 * tabla.
 *
 * `anchorStatus` nunca es `null` en la salida: el handler ya lo resuelve a
 * `"Pending"` sin TXID y a `"Confirmed"` como default cuando hay TXID sin
 * evento (regla 17 aplicada del lado del servidor, no del cliente).
 */
export const projectDocumentSchema = z.strictObject({
  id: z.string(),
  stageId: z.string().nullable(),
  evidenceType: evidenceTypeSchema,
  category: z.string(),
  authoritative: z.boolean(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256Hash: z.string(),
  uploadedAt: z.coerce.date(),
  txid: z.string().nullable(),
  anchorStatus: z.string()
});
export type ProjectDocument = z.infer<typeof projectDocumentSchema>;

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

/**
 * Un paso del camino de Merkle: con qué hermano combinar y de qué lado.
 * Deriva de `MerkleStep` (SPEC-404, P-06) — la línea de abajo no compila si
 * alguna de las dos declaraciones gana o pierde un campo sin la otra.
 */
export const merkleStepSchema = z.strictObject({
  sibling: z.string(),
  position: z.enum(["left", "right"])
});
const _merkleStepSchemaMatchesInterface: Equal<z.infer<typeof merkleStepSchema>, MerkleStep> = true;
void _merkleStepSchemaMatchesInterface;

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

/** Fila 25m — `GET /evidence/:bundleId/files`: los archivos del bundle con su hash. */
export const bundleFilesSchema = z.strictObject({
  bundleId: z.string(),
  merkleRoot: z.string(),
  files: z.array(
    z.strictObject({
      evidenceId: z.string(),
      sha256Hash: z.string(),
      /** `null` solo si el `leftJoin` con `Evidence` no encontró la fila. */
      filename: z.string().nullable()
    })
  )
});
export type BundleFiles = z.infer<typeof bundleFilesSchema>;

/**
 * Fila 38/44c — `POST /developer/projects/:id/stages/:stageId/evidence`. Lo
 * que alimenta el `AnchoringSuccessModal`: la evidencia recién creada, el
 * bundle que la contiene y el anclaje — TXID/Merkle root en la misma
 * respuesta (M2-D5 §2.2).
 */
export const stageEvidenceUploadResultSchema = z.strictObject({
  evidence: evidenceSchema,
  bundleId: z.string(),
  merkleRoot: z.string(),
  anchor: onChainEventSchema
});
export type StageEvidenceUploadResult = z.infer<typeof stageEvidenceUploadResultSchema>;
