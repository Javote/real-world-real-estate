import { describe, expect, it } from "vitest";
import { stageEvidenceUploadSchema } from "./documents";

// SPEC-403 — `authoritative` solo entendía el literal "true"; todo lo demás
// (incluido "on", lo que manda un checkbox real) caía en `false` sin ruido.

const base = { evidenceType: "document" as const, category: "planos" };

describe("stageEvidenceUploadSchema.authoritative", () => {
  it.each(["true", "on", "1"])("%s se lee como true", (valor) => {
    expect(stageEvidenceUploadSchema.parse({ ...base, authoritative: valor }).authoritative).toBe(
      true
    );
  });

  it.each(["false", "off", "0", ""])("%s se lee como false", (valor) => {
    expect(stageEvidenceUploadSchema.parse({ ...base, authoritative: valor }).authoritative).toBe(
      false
    );
  });

  it("ausente es false", () => {
    expect(stageEvidenceUploadSchema.parse({ ...base }).authoritative).toBe(false);
  });

  it.each(["True", "TRUE", "On", "ON"])("%s no distingue mayúsculas", (valor) => {
    expect(stageEvidenceUploadSchema.parse({ ...base, authoritative: valor }).authoritative).toBe(
      true
    );
  });

  it.each(["sí", "maybe", "2"])("%s no es reconocible: falla el parseo", (valor) => {
    expect(() => stageEvidenceUploadSchema.parse({ ...base, authoritative: valor })).toThrow();
  });
});
