import { describe, expect, it } from "vitest";
import { npsSummarySchema, respondNpsSurveySchema } from "./nps";

describe("respondNpsSurveySchema", () => {
  it("el score es un entero de 0 a 10: ni 11, ni -1, ni 7.5", () => {
    for (const score of [0, 10]) {
      expect(respondNpsSurveySchema.safeParse({ score }).success).toBe(true);
    }
    for (const score of [11, -1, 7.5]) {
      expect(respondNpsSurveySchema.safeParse({ score }).success).toBe(false);
    }
  });

  it("el comentario es opcional", () => {
    expect(respondNpsSurveySchema.safeParse({ score: 9, comment: "" }).success).toBe(true);
    expect(respondNpsSurveySchema.safeParse({ score: 9 }).success).toBe(true);
  });
});

describe("npsSummarySchema", () => {
  it("score null sin respuestas: no es lo mismo que 0", () => {
    const vacio = {
      promoters: 0,
      passives: 0,
      detractors: 0,
      responseCount: 0,
      sentCount: 0,
      score: null,
      minimumResponses: 30,
      belowMinimum: true
    };
    expect(npsSummarySchema.safeParse(vacio).success).toBe(true);
    expect(npsSummarySchema.safeParse({ ...vacio, score: 101 }).success).toBe(false);
  });
});
