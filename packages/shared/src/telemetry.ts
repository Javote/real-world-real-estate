import { z } from "zod";

export const reservationToEscrowTelemetrySchema = z.strictObject({
  sampleSize: z.number().int().nonnegative(),
  medianMinutes: z.number().nullable(),
  maxMinutes: z.number().nullable(),
  withBlockTimestampCount: z.number().int().nonnegative()
});
export type ReservationToEscrowTelemetry = z.infer<typeof reservationToEscrowTelemetrySchema>;
