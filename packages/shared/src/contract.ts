import { z } from "zod";
import { onChainEventSchema, onChainEventStatusSchema } from "./stage";
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

/**
 * La fila de `Contract` completa (`POST /investor/invitations/:id/accept`).
 * `signedAt` es otro de los cinco campos sin coercionar: epoch ms crudo.
 */
export const contractSchema = z.strictObject({
  id: z.string(),
  unitId: z.string(),
  investorId: z.string(),
  totalMinorUnits: z.number().int().positive(),
  currency: z.string(),
  signedAt: z.number().nullable(),
  createdAt: z.coerce.date()
});
export type ContractResponse = z.infer<typeof contractSchema>;

/** `POST /investor/invitations/:id/accept`: el contrato recién creado, con su anclaje. */
export const acceptInvitationResultSchema = z.strictObject({
  contract: contractSchema,
  anchor: onChainEventSchema
});
export type AcceptInvitationResult = z.infer<typeof acceptInvitationResultSchema>;

/** Fila 23-24 — `GET /investor/contracts/:unitId`: el contrato de la unidad del investor. */
export const investorContractSchema = z.strictObject({
  id: z.string(),
  totalMinorUnits: z.number().int().positive(),
  currency: z.string(),
  signedAt: z.number().nullable(),
  investorId: z.string(),
  unitReference: z.string()
});
export type InvestorContract = z.infer<typeof investorContractSchema>;

/**
 * Fila 23-24 — `GET /contracts/:contractId/releases` (patrón P10). `anchorStatus`
 * es `null` cuando el `leftJoin` con `OnChainEvent` no encuentra el evento de
 * la liberación. `releasedAt` sin coercionar, mismo motivo que `signedAt`.
 */
export const contractReleaseSchema = z.strictObject({
  id: z.string(),
  stageNumber: z.number().int().positive(),
  amountMinorUnits: z.number().int().positive(),
  releasedAt: z.number(),
  commitment: z.string().nullable(),
  txid: z.string().nullable(),
  anchorStatus: onChainEventStatusSchema.nullable()
});
export type ContractRelease = z.infer<typeof contractReleaseSchema>;
