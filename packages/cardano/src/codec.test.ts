import { Constr, Data } from "@lucid-evolution/lucid";
import { buildStageDatum } from "@plataforma/shared";
import { describe, expect, it } from "vitest";
import {
  decodeStageDatum,
  encodeAdvanceRedeemer,
  encodeInitRedeemer,
  encodeStageDatum,
  stageDatumToData
} from "./codec";
import { AnchorRejectedError } from "./port";

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

  it("rechaza un índice de estado que no es ninguno de los cuatro conocidos", () => {
    const constr = stageDatumToData(datum);
    const conEstadoInvalido = new Constr(constr.index, [
      ...constr.fields.slice(0, 4),
      new Constr(9, []),
      ...constr.fields.slice(5)
    ]);

    expect(() => decodeStageDatum(Data.to(conEstadoInvalido))).toThrow(
      /Índice de estado desconocido/
    );
  });
});

describe("decodeStageDatum valida lo que vuelve de la cadena (SPEC-408)", () => {
  const campos = stageDatumToData(datum).fields;

  function conCampos(fields: Data[], index = 0): string {
    return Data.to(new Constr(index, fields));
  }

  function conCampo(posicion: number, valor: Data): string {
    return conCampos(campos.map((campo, i) => (i === posicion ? valor : campo)));
  }

  function rechazo(hex: string): unknown {
    try {
      decodeStageDatum(hex);
    } catch (error) {
      return error;
    }
    throw new Error("decodeStageDatum no rechazó");
  }

  it("un datum válido sale igual que antes, campo por campo", () => {
    const completo = buildStageDatum({
      id: "stage",
      projectId: "project",
      sequenceOrder: 7,
      validationCritical: false,
      state: "Completed",
      evidenceRoot: "c".repeat(64),
      completedAt: 1_759_400_000_000
    });
    expect(decodeStageDatum(encodeStageDatum(completo))).toEqual(completo);
  });

  it.each([
    ["4 campos", conCampos(campos.slice(0, 4))],
    ["6 campos", conCampos(campos.slice(0, 6))],
    ["8 campos", conCampos([...campos, 0n])],
    ["otro constructor", conCampos(campos, 1)],
    ["un entero en vez de un Constr", Data.to(5n)],
    ["sequenceOrder en cero", conCampo(2, 0n)],
    ["sequenceOrder negativo", conCampo(2, -3n)],
    ["sequenceOrder que no es un entero", conCampo(2, "ab")],
    ["sequenceOrder fuera del rango seguro", conCampo(2, 2n ** 60n)],
    ["validationCritical que no es Bool", conCampo(3, new Constr(2, []))],
    ["validationCritical que no es un Constr", conCampo(3, 1n)],
    ["validationCritical con campos", conCampo(3, new Constr(1, [0n]))],
    ["state que no es un Constr", conCampo(4, 1n)],
    ["state con campos", conCampo(4, new Constr(1, [0n]))],
    ["evidenceRoot que no es hex64 ni vacío", conCampo(5, "abcd")],
    ["evidenceRoot que no son bytes", conCampo(5, 0n)],
    ["projectRef que es un Constr", conCampo(0, new Constr(0, []))],
    ["projectRef vacío", conCampo(0, "")],
    ["stageRef que es un entero", conCampo(1, 42n)],
    ["completedAt negativo", conCampo(6, -1n)]
  ])("%s: AnchorRejectedError BAD_DATUM, nunca un TypeError", (_, hex) => {
    const error = rechazo(hex);
    expect(error).toBeInstanceOf(AnchorRejectedError);
    expect(error).toMatchObject({ code: "BAD_DATUM" });
  });

  it("un índice de estado desconocido es BAD_DATUM y conserva el mensaje", () => {
    const error = rechazo(conCampo(4, new Constr(4, [])));
    expect(error).toBeInstanceOf(AnchorRejectedError);
    expect(error).toMatchObject({
      code: "BAD_DATUM",
      message: expect.stringMatching(/Índice de estado desconocido en el datum: 4/)
    });
  });

  it("el CBOR que va a la cadena no cambió", () => {
    expect(encodeStageDatum(decodeStageDatum(GOLDEN))).toBe(GOLDEN);
  });
});

describe("redeemers", () => {
  it("Advance sin completion usa None", () => {
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
