import { describe, expect, it } from "vitest";
import { en } from "../src/lib/arrays";

describe("en — SPEC-208 (B-12)", () => {
  it("devuelve el valor cuando el índice está en rango", () => {
    expect(en(["a", "b", "c"], 1)).toBe("b");
  });

  it("tira si el índice queda fuera de rango, en vez de devolver undefined", () => {
    expect(() => en(["a", "b"], 5)).toThrow(/Index 5 out of bounds for array of length 2/);
  });
});
