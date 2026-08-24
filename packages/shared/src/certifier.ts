import { z } from "zod";
import { stageStateSchema } from "./stage";

// Las respuestas de la superficie del certifier (M2-D5 filas 56v y 58).
//
// **El certifier no certifica validez legal** (D-026). Verifica integridad y
// completitud contra los hashes anclados. El endpoint se llama `certify` porque
// así lo nombra M2-D5; lo que hace es cerrar el stage y anclar su prueba.

/** Un archivo de evidencia, como lo ve el certifier antes de decidir. */
export const certifierEvidenceSchema = z.strictObject({
  id: z.string(),
  originalFilename: z.string(),
  category: z.string(),
  authoritative: z.boolean(),
  /** SHA-256 completo (regla 16). `null` si todavía no se hasheó. */
  sha256Hash: z.string().nullable(),
  uploadedAt: z.coerce.date()
});
export type CertifierEvidence = z.infer<typeof certifierEvidenceSchema>;

/** Fila 56v — el stage a certificar, con su evidencia. */
export const certifierStageViewSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  sequenceOrder: z.number().int().positive(),
  state: stageStateSchema,
  validationCritical: z.boolean(),
  projectId: z.string(),
  projectName: z.string(),
  /**
   * **Puede venir vacía, y eso es diseño, no error.** El empty-state de la
   * fila 56v es parte de la pantalla: un stage sin evidencia se ve, con su
   * mensaje, y las acciones quedan a la vista para que el certifier entienda
   * por qué no puede certificar todavía.
   */
  evidence: z.array(certifierEvidenceSchema)
});
export type CertifierStageView = z.infer<typeof certifierStageViewSchema>;

/** Fila 58 — un certificado emitido, con su huella y su prueba. */
export const certifierCertificateSchema = z.strictObject({
  stageId: z.string(),
  stageName: z.string(),
  projectName: z.string(),
  certifiedAt: z.coerce.date().nullable(),
  /** Merkle root del bundle que se certificó. */
  commitmentHash: z.string().nullable(),
  /** `null` ⇒ el estado es "Pendiente", nunca "Certificado" (regla 17). */
  txid: z.string().nullable(),
  anchorStatus: z.string().nullable()
});
export type CertifierCertificate = z.infer<typeof certifierCertificateSchema>;
