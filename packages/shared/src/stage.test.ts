import { describe, expect, it } from "vitest";
import {
  canTransition,
  DEFAULT_STAGE_CATALOG,
  INITIAL_STAGE_STATE,
  STAGE_STATES,
  stageStateSchema
} from "./stage";

// El espejo del validador se prueba igual que el validador: **exhaustivo**.
// `contracts/lib/propnexus/fsm.ak` tiene los mismos 16 pares (4 × 4) uno por
// uno; acá se generan, y la tabla esperada se escribe a mano para que un
// cambio en la implementación no arrastre al test con él.
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
    // La regla 9 dice terminal, y "terminal" no admite excepciones: si esta
    // prueba se rompe, el validador Aiken va a rechazar lo que la API aceptó.
    expect(STAGE_STATES.filter((to) => canTransition("Completed", to))).toEqual([]);
  });
});

describe("stageStateSchema", () => {
  it("acepta los cuatro estados y nada más", () => {
    for (const state of STAGE_STATES) {
      expect(stageStateSchema.safeParse(state).success).toBe(true);
    }
    // `Certified` es el estado que M1 §README nombra y el `.puml` no: gana el
    // `.puml` (D-020). Que no entre por acá es parte de esa decisión.
    expect(stageStateSchema.safeParse("Certified").success).toBe(false);
  });

  it("nace en Pending", () => {
    expect(INITIAL_STAGE_STATE).toBe("Pending");
  });
});

describe("DEFAULT_STAGE_CATALOG", () => {
  // M2-D1 §5.2, captura 34C: "Standard template (10 stages)".
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
