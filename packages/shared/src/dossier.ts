import { z } from "zod";
import { onChainEventSchema } from "./stage";

// El dossier (M2-D5 filas 26-29, 28s, 51-53) — **M3-BE-12** y **M3-BE-17**.
//
// M2-D5 §3 lo define: *"Dossier compilation is on-demand from authoritative
// back-end state. The dossier hash is computed at the moment of fetch and is
// stable as long as the underlying anchored artifacts have not changed"*. O sea
// el `masterHash` **no se guarda y se sirve**: se recomputa en cada lectura, y
// si cambió es porque cambió lo que compromete. Esa es toda la garantía que el
// patrón P8 puede sostener.
//
// **Lo que un dossier NO afirma** (D-026): no dice que la obra esté bien, ni
// que los documentos sean auténticos. Dice que estos hashes existían, con estos
// timestamps, y que este notario atestiguó haberlos revisado.

/** Cada artefacto que entra al hash maestro, en el orden en que entra. */
export const dossierArtifactSchema = z.strictObject({
  kind: z.enum(["stage", "evidence", "release"]),
  /** Ref opaca al registro off-chain. */
  referenceId: z.string(),
  label: z.string(),
  /** SHA-256 completo — la truncación 6+4 la hace `HashChip` (regla 16). */
  sha256: z.string().nullable(),
  /** Case-sensitive y verbatim (regla 16). `null` = sin anclar todavía. */
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
  /** SHA-256 de la lista canónica de artefactos. Recomputado en cada lectura. */
  masterHash: z.string(),
  compiledAt: z.coerce.date(),
  status: dossierStatusSchema,
  artifacts: z.array(dossierArtifactSchema),
  /**
   * Completitud 0-100: qué fracción de los artefactos tiene su prueba
   * sustanciada. **No es "cuán listo está el dossier"**: es cuántas de sus
   * piezas pueden mostrar un TXID (regla 17).
   */
  completeness: z.number().int().min(0).max(100),
  /** TXID de la firma del notario. `null` mientras no esté firmado (P8). */
  signatureTxid: z.string().nullable(),
  signedAt: z.coerce.date().nullable(),
  rejectionNote: z.string().nullable()
});
export type Dossier = z.infer<typeof dossierSchema>;

/** Respuesta de `POST /investor/units/:id/dossier/share` (fila 28s). */
export const dossierShareSchema = z.strictObject({
  shareToken: z.string(),
  /** Path público, sin host: el cliente lo compone con su propio origen. */
  path: z.string(),
  masterHash: z.string()
});
export type DossierShare = z.infer<typeof dossierShareSchema>;

/** Una firma del historial del notario (fila 53). */
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

/**
 * Body de `POST /notary/dossiers/:id/reject` (fila 52r). Misma forma que
 * `observeStageSchema` de `stage.ts` —una nota, 1 a 2000 caracteres— pero es
 * otro dominio (rechazo de dossier, no observación de stage) y con otro
 * destino (`Dossier.rejectionNote`, no el `AuditLog` de una transición): dos
 * schemas iguales de casualidad, no uno compartido.
 */
export const rejectDossierSchema = z.strictObject({ note: z.string().min(1).max(2000) });
export type RejectDossierInput = z.infer<typeof rejectDossierSchema>;

/**
 * `POST /notary/dossiers/:id/sign`. Dos formas reales, no una idealizada
 * (regla 5): recién firmado manda `signedAt` y siempre trae `anchor`; el
 * camino idempotente (ya estaba `signed`) no manda `signedAt`, y `anchor`
 * puede faltar si el evento de la firma original no se encontró al reconciliar.
 */
export const dossierSignResultSchema = z.strictObject({
  dossierId: z.string(),
  masterHash: z.string(),
  signedAt: z.coerce.date().optional(),
  anchor: onChainEventSchema.optional()
});
export type DossierSignResult = z.infer<typeof dossierSignResultSchema>;

/** `POST /notary/dossiers/:id/reject`. No ancla — no hay `anchor` que devolver. */
export const dossierRejectResultSchema = z.strictObject({
  dossierId: z.string(),
  status: z.literal("rejected")
});
export type DossierRejectResult = z.infer<typeof dossierRejectResultSchema>;

/**
 * Fila 28s — `GET /public/dossier/:shareToken`. **Sin sesión** (M2-D5 §2.2):
 * recortado a propósito, nada de la unidad ni del investor más allá de su
 * referencia — sin `id`/`unitId`/`projectId`/`rejectionNote` de `dossierSchema`.
 */
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
