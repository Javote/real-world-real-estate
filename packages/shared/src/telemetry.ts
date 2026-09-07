import { z } from "zod";

// Milestone 3 §3 — mediana reserva → creación de escrow < 12 min (D-021: desde
// que el investor acepta la invitación hasta que el contrato queda creado y
// anclado con TXID confirmado). Se mide sobre `OnChainEvent` de tipo
// `INVITATION_ACCEPTED`: `createdAt` es el instante de la reserva (la
// declaración se escribe en la misma request que acepta la invitación,
// D-059), `updatedAt` es cuándo `reconciliarAnclajes` lo vio `Confirmed`.

/** Fila 9 del SOM — la mediana no existe todavía si no hay muestras confirmadas. */
export const reservationToEscrowTelemetrySchema = z.strictObject({
  sampleSize: z.number().int().nonnegative(),
  medianMinutes: z.number().nullable(),
  maxMinutes: z.number().nullable()
});
export type ReservationToEscrowTelemetry = z.infer<typeof reservationToEscrowTelemetrySchema>;
