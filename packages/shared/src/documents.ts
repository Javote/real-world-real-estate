import { z } from "zod";

// La documentación de respaldo del developer (M2-D5 filas 46-47) — **M3-BE-14**.
//
// Es la misma `Evidence` que sube el flujo de etapas, vista desde el ángulo del
// developer: qué documentos del proyecto están anclados y cuáles todavía no.

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
