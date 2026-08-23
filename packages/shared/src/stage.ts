import { z } from "zod";

// La máquina de estados del stage de obra, escrita UNA vez para los dos lados
// de la frontera (D-020, regla 9).
//
// **Por qué vive acá y no en la ruta.** Hasta el 2026-08-23 la tabla existía
// solo en Aiken (`contracts/lib/propnexus/fsm.ak`) y la API aceptaba cualquier
// estado desde cualquier estado. Dos implementaciones de la misma regla que no
// se hablan divergen en silencio; peor todavía: el día que exista el anclaje
// (D-014), una transición que la API acepta y el validador rechaza arma la
// transacción, la firma, paga el fee y **falla en la cadena** — con la base
// diciendo una cosa y la cadena otra.
//
// **Este archivo es el espejo del validador.** Si cambia una, cambian las dos
// en el mismo commit.

/** Espeja `StageState` de `contracts/lib/propnexus/fsm.ak`. */
export const STAGE_STATES = ["Pending", "InProgress", "Observed", "Completed"] as const;

export const stageStateSchema = z.enum(STAGE_STATES);
export type StageState = z.infer<typeof stageStateSchema>;

/**
 * La tabla de transiciones. Sale textual de `M1-D2/3-milestone-lifecycle.puml`:
 *
 * ```
 * Pending → InProgress → Completed        (Completed es TERMINAL)
 *              ↑↓
 *           Observed                       (remediación, no estado final)
 * ```
 *
 * `Observed` es el camino de remediación, no un estado final. `Completed` no
 * tiene salida: se llama así —y no `Certified`— porque la plataforma no
 * certifica (D-020 sobre D-026).
 */
export const STAGE_TRANSITIONS: Readonly<Record<StageState, readonly StageState[]>> = {
  Pending: ["InProgress"],
  InProgress: ["Observed", "Completed"],
  Observed: ["InProgress"],
  Completed: []
};

/** El estado con el que nace todo stage. El validador lo exige al acuñar el hilo. */
export const INITIAL_STAGE_STATE: StageState = "Pending";

export function canTransition(from: StageState, to: StageState): boolean {
  return STAGE_TRANSITIONS[from].includes(to);
}

/**
 * Motivo por el que una transición se rechaza. Son claves, no copy: el cliente
 * las traduce (regla 15).
 */
export const STAGE_TRANSITION_ERRORS = {
  invalid: "STAGE_TRANSITION_INVALID",
  evidenceRequired: "STAGE_EVIDENCE_REQUIRED"
} as const;

export const stageTransitionSchema = z.strictObject({
  state: stageStateSchema
});

export type StageTransitionInput = z.infer<typeof stageTransitionSchema>;
