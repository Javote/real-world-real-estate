import { describe, expect, it } from "vitest";
import {
  canTransition,
  DEFAULT_STAGE_CATALOG,
  INITIAL_STAGE_STATE,
  STAGE_STATES,
  stageStateSchema
} from "./stage";

const ESPERADO: Record<string, boolean> = {
  "Pending→InProgress": true,
  "InProgress→Observed": true,
  "InProgress→Completed": true,
  "Observed→InProgress": true
};

describe("canTransition", () => {
  for (const from of STAGE_STATES) {
    for (const to of STAGE_STATES) {
      const par = `${from}→${to}`;
      const esperado = ESPERADO[par] ?? false;
      it(`${esperado ? "acepta" : "rechaza"} ${par}`, () => {
        expect(canTransition(from, to)).toBe(esperado);
      });
    }
  }

  it("deja Completed sin ninguna salida", () => {
    expect(STAGE_STATES.filter((to) => canTransition("Completed", to))).toEqual([]);
  });
});

describe("stageStateSchema", () => {
  it("acepta los cuatro estados y nada más", () => {
    for (const state of STAGE_STATES) {
      expect(stageStateSchema.safeParse(state).success).toBe(true);
    }
    expect(stageStateSchema.safeParse("Certified").success).toBe(false);
  });

  it("nace en Pending", () => {
    expect(INITIAL_STAGE_STATE).toBe("Pending");
  });
});

describe("DEFAULT_STAGE_CATALOG", () => {
  it("tiene las 10 etapas del Stage template", () => {
    expect(DEFAULT_STAGE_CATALOG.length).toBe(10);
  });

  it("ningún nombre está vacío", () => {
    for (const etapa of DEFAULT_STAGE_CATALOG) {
      expect(etapa.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("sequenceOrder es 1..N sin huecos ni repetidos", () => {
    const ordenes = DEFAULT_STAGE_CATALOG.map((e) => e.sequenceOrder).sort((a, b) => a - b);
    expect(ordenes).toEqual(DEFAULT_STAGE_CATALOG.map((_, i) => i + 1));
  });
});
