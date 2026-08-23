import { buildStageDatum } from "@plataforma/shared";
import { describe, expect, it } from "vitest";
import {
  decodeStageDatum,
  encodeAdvanceRedeemer,
  encodeInitRedeemer,
  encodeStageDatum
} from "./codec";

// **El valor dorado.** Este mismo hex está fijado en Aiken
// (`t_golden_datum_encoding`, en `contracts/lib/propnexus/fsm.ak`) sobre el
// mismo datum. Si los dos lados no producen exactamente estos bytes, la
// transacción se firma, se paga y el validador la rechaza con un error inútil.
//
// Que sea idéntico y no "equivalente" importa: un cambio de orden de campos o
// de índice de constructor pasa el typecheck, pasa los tests de lógica, y
// falla recién en la cadena.
const GOLDEN = "d8799f4770726f6a65637445737461676501d87a80d879804000ff";

const datum = buildStageDatum({
  id: "stage",
  projectId: "project",
  sequenceOrder: 1,
  validationCritical: true,
  state: "Pending"
});

describe("encodeStageDatum", () => {
  it("produce exactamente el CBOR que serializa Aiken", () => {
    expect(encodeStageDatum(datum)).toBe(GOLDEN);
  });

  it("va y vuelve sin perder ningún campo", () => {
    expect(decodeStageDatum(encodeStageDatum(datum))).toEqual(datum);
  });

  it("distingue los cuatro estados por índice de constructor", () => {
    // Pending=0 · InProgress=1 · Observed=2 · Completed=3, que es el orden de
    // declaración del tipo en Aiken y nada más que eso.
    for (const [state, marca] of [
      ["Pending", "d87980"],
      ["InProgress", "d87a80"],
      ["Observed", "d87b80"],
      ["Completed", "d87c80"]
    ] as const) {
      const codificado = encodeStageDatum({ ...datum, state });
      expect(codificado).toContain(marca);
      expect(decodeStageDatum(codificado).state).toBe(state);
    }
  });

  it("codifica el booleano con la convención de Plutus (False=0, True=1)", () => {
    expect(
      decodeStageDatum(encodeStageDatum({ ...datum, validationCritical: false })).validationCritical
    ).toBe(false);
    expect(encodeStageDatum({ ...datum, validationCritical: false })).toContain("d87980");
  });
});

describe("redeemers", () => {
  it("Advance sin completion usa None", () => {
    // None es el constructor 1 de Option. Mandarlo al revés hace que el
    // validador crea que se está completando el stage.
    expect(encodeAdvanceRedeemer({ to: "InProgress", completion: null })).toBe(
      "d8799fd87a80d87a80ff"
    );
  });

  it("Advance con completion envuelve Some(Completion)", () => {
    const root = "a".repeat(64);
    const hex = encodeAdvanceRedeemer({
      to: "Completed",
      completion: { evidenceRoot: root, now: 5 }
    });
    expect(hex).toContain(root);
    expect(hex.startsWith("d8799fd87c80")).toBe(true);
  });

  it("Init es el constructor único del mint", () => {
    expect(encodeInitRedeemer()).toBe("d87980");
  });
});
