import { describe, expect, it } from "vitest";
import { reservationToEscrowTelemetrySchema } from "./telemetry";

describe("reservationToEscrowTelemetrySchema", () => {
  it("acepta la forma completa, con muestras", () => {
    expect(
      reservationToEscrowTelemetrySchema.safeParse({
        sampleSize: 30,
        medianMinutes: 8.5,
        maxMinutes: 22,
        withBlockTimestampCount: 30
      }).success
    ).toBe(true);
  });

  it("acepta medianas y máximos null — todavía no hay muestras confirmadas", () => {
    expect(
      reservationToEscrowTelemetrySchema.safeParse({
        sampleSize: 0,
        medianMinutes: null,
        maxMinutes: null,
        withBlockTimestampCount: 0
      }).success
    ).toBe(true);
  });

  it("rechaza sampleSize negativo o no entero", () => {
    expect(
      reservationToEscrowTelemetrySchema.safeParse({
        sampleSize: -1,
        medianMinutes: null,
        maxMinutes: null,
        withBlockTimestampCount: 0
      }).success
    ).toBe(false);
    expect(
      reservationToEscrowTelemetrySchema.safeParse({
        sampleSize: 1.5,
        medianMinutes: null,
        maxMinutes: null,
        withBlockTimestampCount: 0
      }).success
    ).toBe(false);
  });

  it("rechaza una clave desconocida — es strictObject", () => {
    expect(
      reservationToEscrowTelemetrySchema.safeParse({
        sampleSize: 1,
        medianMinutes: 1,
        maxMinutes: 1,
        withBlockTimestampCount: 1,
        extra: "no"
      }).success
    ).toBe(false);
  });
});
