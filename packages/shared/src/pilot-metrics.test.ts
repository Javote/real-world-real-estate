import { describe, expect, it } from "vitest";
import {
  documentCompletenessQuerySchema,
  documentCompletenessSchema,
  pilotMetricsQuerySchema,
  pilotMetricsSchema
} from "./pilot-metrics";

describe("documentCompletenessSchema", () => {
  it("acepta rate y overallRate null: sin stages críticos no hay completitud, ni 0 ni 100%", () => {
    expect(
      documentCompletenessSchema.safeParse({
        perUnit: [{ unitId: "u", completedRequired: 0, totalRequired: 0, rate: null }],
        overallRate: null
      }).success
    ).toBe(true);
  });

  it("rate es una proporción de 0 a 1, no un porcentaje", () => {
    expect(
      documentCompletenessSchema.safeParse({
        perUnit: [{ unitId: "u", completedRequired: 10, totalRequired: 10, rate: 100 }],
        overallRate: 1
      }).success
    ).toBe(false);
  });

  it("es estricto: una clave de más no pasa en silencio", () => {
    expect(
      documentCompletenessSchema.safeParse({ perUnit: [], overallRate: null, extra: 1 }).success
    ).toBe(false);
  });
});

describe("documentCompletenessQuerySchema", () => {
  it("projectId es opcional, y si viene tiene forma de id", () => {
    expect(documentCompletenessQuerySchema.safeParse({}).success).toBe(true);
    expect(documentCompletenessQuerySchema.safeParse({ projectId: "no-es-un-id" }).success).toBe(
      false
    );
  });
});

describe("pilotMetricsQuerySchema", () => {
  const ID = "a".repeat(24);

  it("projectIds es una lista de ids separados por coma, sin espacios", () => {
    expect(pilotMetricsQuerySchema.safeParse({ projectIds: `${ID},${ID}` }).success).toBe(true);
    expect(pilotMetricsQuerySchema.safeParse({ projectIds: `${ID}, ${ID}` }).success).toBe(false);
    expect(pilotMetricsQuerySchema.safeParse({ projectIds: "" }).success).toBe(false);
    expect(pilotMetricsQuerySchema.safeParse({}).success).toBe(true);
  });
});

describe("pilotMetricsSchema", () => {
  const base = {
    signedContractsCount: 0,
    evidenceBundlesCount: 0,
    releasesCount: 0,
    uniqueWalletsCount: null,
    declaredValueByCurrency: [],
    documentCompletenessRate: null,
    disputesCount: 0,
    disputeRate: null,
    nps: {
      promoters: 0,
      passives: 0,
      detractors: 0,
      responseCount: 0,
      sentCount: 0,
      score: null,
      minimumResponses: 30,
      belowMinimum: true
    }
  };

  it("uniqueWalletsCount solo puede ser null: hoy no se mide", () => {
    expect(pilotMetricsSchema.safeParse(base).success).toBe(true);
    expect(pilotMetricsSchema.safeParse({ ...base, uniqueWalletsCount: 1 }).success).toBe(false);
  });

  it("disputeRate puede pasar de 1: se disputa por liberación, no es una proporción", () => {
    expect(pilotMetricsSchema.safeParse({ ...base, disputeRate: 1.5 }).success).toBe(true);
    expect(pilotMetricsSchema.safeParse({ ...base, disputeRate: -0.1 }).success).toBe(false);
  });
});
