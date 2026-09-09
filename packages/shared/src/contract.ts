import { z } from "zod";
import { onChainEventSchema } from "./stage";
import { unitStatusSchema } from "./unit";

// El contrato como registro (D-070): quién acordó qué sobre qué unidad, sin
// administrar fondos. La única mutación con body propio es la liberación.

/** Body de `POST /developer/contracts/:id/releases/:stageNum`. */
export const releasePaymentSchema = z.strictObject({
  amountMinorUnits: z.number().int().positive()
});
export type ReleasePaymentInput = z.infer<typeof releasePaymentSchema>;

/**
 * Fila 40-41 — `GET /developer/projects/:id/contracts`. `investorEmail` se
 * usa para calzar el anclaje correcto (ver el comentario de la ruta) y se
 * descarta antes de responder: no está acá porque el handler nunca lo manda.
 *
 * `signedAt` no está en `TIMESTAMP_COLUMNS` del plugin de coerción (ver la
 * nota en `invitationSchema`): llega como epoch ms crudo, no como `Date`.
 */
export const developerContractSchema = z.strictObject({
  id: z.string(),
  totalMinorUnits: z.number().int().positive(),
  currency: z.string(),
  signedAt: z.number().nullable(),
  unitId: z.string(),
  unitReference: z.string(),
  unitStatus: unitStatusSchema,
  investorName: z.string(),
  txid: z.string().nullable(),
  commitment: z.string().nullable()
});
export type DeveloperContract = z.infer<typeof developerContractSchema>;

/**
 * La fila de `PaymentAttestation` completa. `releasedAt` es otro de los cinco
 * campos sin coercionar (mismo motivo que `signedAt` arriba): epoch ms crudo.
 */
export const paymentAttestationSchema = z.strictObject({
  id: z.string(),
  contractId: z.string(),
  stageNumber: z.number().int().positive(),
  amountMinorUnits: z.number().int().positive(),
  releasedById: z.string().nullable(),
  releasedAt: z.number()
});
export type PaymentAttestationResponse = z.infer<typeof paymentAttestationSchema>;

/** `POST /developer/contracts/:id/releases/:stageNum`, recién liberada (201). */
export const paymentReleaseResultSchema = paymentAttestationSchema.extend({
  anchor: onChainEventSchema
});
export type PaymentReleaseResult = z.infer<typeof paymentReleaseResultSchema>;
