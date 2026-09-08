import { z } from "zod";

// El contrato como registro (D-070): quién acordó qué sobre qué unidad, sin
// administrar fondos. La única mutación con body propio es la liberación.

/** Body de `POST /developer/contracts/:id/releases/:stageNum`. */
export const releasePaymentSchema = z.strictObject({
  amountMinorUnits: z.number().int().positive()
});
export type ReleasePaymentInput = z.infer<typeof releasePaymentSchema>;
