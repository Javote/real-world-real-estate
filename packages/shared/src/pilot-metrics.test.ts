import { describe, expect, it } from "vitest";
import { documentCompletenessQuerySchema, documentCompletenessSchema } from "./pilot-metrics";

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
