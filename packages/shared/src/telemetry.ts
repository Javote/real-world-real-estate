import { z } from "zod";

// Milestone 3 §3 — mediana reserva → creación de escrow < 12 min (D-021: desde
// que el investor acepta la invitación hasta que el contrato queda creado y
// anclado con TXID confirmado). Se mide sobre `OnChainEvent` de tipo
// `INVITATION_ACCEPTED`: `createdAt` es el instante de la reserva (la
// declaración se escribe en la misma request que acepta la invitación,
// D-059).
//
// SPEC-214: el fin del intervalo es `blockTimestamp` —el momento real en que
// la transacción entró en un bloque— y no `updatedAt`, que es cuándo alguien
// disparó una lectura que reconcilió el evento (D-077: el disparo es por
// lectura, no hay poll en background). Antes de esta spec el endpoint medía
// `updatedAt - createdAt`, que suma "lo que tardó la cadena" MÁS "lo que
// tardó alguien en volver a leer algo de ese proyecto" — el cierre del
// criterio 9 (2026-09-11) encontró exactamente ese hueco. `updatedAt` sigue
// siendo el respaldo para una fila `Confirmed` de antes de que `blockTimestamp`
// se empezara a poblar consistentemente.

/**
 * Fila 9 del SOM — la mediana no existe todavía si no hay muestras
 * confirmadas. `withBlockTimestampCount` es lo que mantiene `sampleSize`
 * interpretable: cuántas de las muestras midieron contra la latencia de
 * cadena real y no contra el respaldo (`sampleSize - withBlockTimestampCount`
 * usaron `updatedAt`).
 */
export const reservationToEscrowTelemetrySchema = z.strictObject({
  sampleSize: z.number().int().nonnegative(),
  medianMinutes: z.number().nullable(),
  maxMinutes: z.number().nullable(),
  withBlockTimestampCount: z.number().int().nonnegative()
});
export type ReservationToEscrowTelemetry = z.infer<typeof reservationToEscrowTelemetrySchema>;
