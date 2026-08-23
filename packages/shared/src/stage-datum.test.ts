import { describe, expect, it } from "vitest";
import {
  buildStageDatum,
  COMMITMENT_HEX_LENGTH,
  canCompleteWithEvidence,
  hexToRef,
  isValidInitialDatum,
  MAX_REF_BYTES,
  refToHex
} from "./stage-datum";

const fuente = {
  id: "clh3k9x0000008l3fabc1234",
  projectId: "clh3k9x0000008l3fdef5678",
  sequenceOrder: 1,
  validationCritical: true,
  state: "Pending" as const
};

const root = "a".repeat(COMMITMENT_HEX_LENGTH);

describe("refToHex", () => {
  it("va y vuelve sin perder nada", () => {
    expect(hexToRef(refToHex(fuente.id))).toBe(fuente.id);
  });

  it("produce dos caracteres hex por byte", () => {
    expect(refToHex("abc")).toBe("616263");
  });

  it("rechaza una ref más larga que un asset name", () => {
    // 32 bytes es el límite de Cardano para el asset name del thread token,
    // no una preferencia nuestra: pasarse no es un warning, es un NFT que no
    // se puede acuñar.
    expect(() => refToHex("x".repeat(MAX_REF_BYTES + 1))).toThrow();
    expect(refToHex("x".repeat(MAX_REF_BYTES))).toHaveLength(MAX_REF_BYTES * 2);
  });

  it("rechaza lo que no sea ASCII imprimible", () => {
    expect(() => refToHex("con espacio")).toThrow();
    expect(() => refToHex("acentué")).toThrow();
    expect(() => refToHex("")).toThrow();
  });
});

describe("buildStageDatum", () => {
  it("produce el datum de un stage recién creado", () => {
    const datum = buildStageDatum(fuente);
    expect(datum.state).toBe("Pending");
    expect(datum.evidenceRoot).toBe("");
    expect(datum.completedAt).toBe(0);
    expect(isValidInitialDatum(datum)).toBe(true);
  });

  it("rechaza un sequenceOrder que no sea positivo", () => {
    expect(() => buildStageDatum({ ...fuente, sequenceOrder: 0 })).toThrow();
  });

  it("rechaza un commitment que no sea SHA-256 en hex", () => {
    expect(() => buildStageDatum({ ...fuente, evidenceRoot: "abc" })).toThrow();
    expect(() => buildStageDatum({ ...fuente, evidenceRoot: root.toUpperCase() })).toThrow();
    expect(buildStageDatum({ ...fuente, evidenceRoot: root }).evidenceRoot).toBe(root);
  });

  it("no deja nacer un stage con evidencia o fecha ya puestas", () => {
    // Es el espejo de `mint_rejects_preloaded_evidence` del validador: si esto
    // pasara, el anclaje fallaría recién al firmar.
    const datum = buildStageDatum({ ...fuente, evidenceRoot: root, completedAt: 5 });
    expect(isValidInitialDatum(datum)).toBe(false);
  });
});

describe("canCompleteWithEvidence", () => {
  it("exige commitment completo solo cuando el stage es crítico", () => {
    expect(canCompleteWithEvidence(true, root)).toBe(true);
    expect(canCompleteWithEvidence(true, "")).toBe(false);
    expect(canCompleteWithEvidence(true, "aabb")).toBe(false);
    expect(canCompleteWithEvidence(false, "")).toBe(true);
  });
});
