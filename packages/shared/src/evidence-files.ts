import { z } from "zod";
import { EVIDENCE_REJECTION_CODES } from "./evidence-rules";

// SPEC-218 — los schemas Zod de la subida de evidencia. Las reglas puras
// (tipos, topes, detección, códigos) están en `evidence-rules.ts`, sin
// dependencias, para que el front las importe sin arrastrar Zod.

export const evidenceRejectionCodeSchema = z.enum(EVIDENCE_REJECTION_CODES);

/**
 * Un archivo rechazado. **`index` es la posición del archivo en el pedido**, no
 * su nombre: el cliente ya sabe cuál era, y así la respuesta no repite un
 * nombre de archivo (regla 2).
 */
export const evidenceRejectionSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  code: evidenceRejectionCodeSchema
});
export type EvidenceRejection = z.infer<typeof evidenceRejectionSchema>;
