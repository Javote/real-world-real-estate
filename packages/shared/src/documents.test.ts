import { describe, expect, it } from "vitest";
import { evidenciaSinAtribuir, stageEvidenceUploadSchema, updateEvidenceSchema } from "./documents";

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

describe("evidenciaSinAtribuir (D-028)", () => {
  it.each([
    [true, null, true],
    [true, undefined, true],
    [true, "   ", true],
    [true, "Municipalidad", false],
    [false, null, false],
    [false, "Municipalidad", false]
  ])("authoritative=%s, issuingAuthority=%j → %s", (authoritative, issuingAuthority, esperado) => {
    expect(evidenciaSinAtribuir({ authoritative, issuingAuthority })).toBe(esperado);
  });
});

describe("updateEvidenceSchema.issuingAuthority", () => {
  it("ausente queda undefined: el PATCH no la toca", () => {
    expect(updateEvidenceSchema.parse({}).issuingAuthority).toBeUndefined();
  });

  it.each([
    [null, null],
    ["   ", null],
    [" Colegio de Escribanos ", "Colegio de Escribanos"]
  ])("%j se normaliza a %j", (valor, esperado) => {
    expect(updateEvidenceSchema.parse({ issuingAuthority: valor }).issuingAuthority).toBe(esperado);
  });

  it("más de 200 caracteres falla", () => {
    expect(() => updateEvidenceSchema.parse({ issuingAuthority: "x".repeat(201) })).toThrow();
  });
});
