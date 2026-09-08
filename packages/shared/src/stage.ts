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
  evidenceRequired: "STAGE_EVIDENCE_REQUIRED",
  /**
   * D-028 (a), acotada por D-084: una evidencia **declarada** `authoritative`
   * que no dice quién la emitió. No se valida la autoridad —la plataforma no
   * valida (D-026)—; se exige que la declaración esté completa.
   */
  evidenceUnattributed: "STAGE_EVIDENCE_UNATTRIBUTED",
  /**
   * M2-D1 §Role Permission Matrix: "Stage certification" y "Stage
   * observation" son acciones **exclusivas del certifier** — el developer
   * (vía `PATCH /stages/:id/state`) solo puede pedir `→ InProgress`
   * (arrancar o reanudar tras una observación). Pedir `→ Completed` o
   * `→ Observed` por esa ruta es a quién le pertenece la acción, no si la FSM
   * la permite — por eso es un código distinto de `invalid`.
   */
  forbidden: "STAGE_TRANSITION_FORBIDDEN"
} as const;

export const stageTransitionSchema = z.strictObject({
  state: stageStateSchema
});

export type StageTransitionInput = z.infer<typeof stageTransitionSchema>;

/**
 * Catálogo placeholder de etapas de obra (M3 §1 — "≥8 stages"). `POST
 * /projects/:id/stages` sigue aceptando un stage libre, uno por uno: esto es
 * lo que la UI puede ofrecer como punto de partida al crear un proyecto, no
 * una restricción. `progressPercentage` es avance de obra (D-021), nunca
 * dinero — las 8 filas suman 100 a propósito, para que un proyecto que
 * adopta el catálogo tal cual tenga un 100% coherente; un developer que edita
 * o agrega stages después rompe esa suma y es esperable que la rompa.
 */
export interface StageCatalogEntry {
  name: string;
  sequenceOrder: number;
  progressPercentage: number;
}

export const DEFAULT_STAGE_CATALOG: readonly StageCatalogEntry[] = [
  { name: "Movimiento de suelos", sequenceOrder: 1, progressPercentage: 5 },
  { name: "Cimentación", sequenceOrder: 2, progressPercentage: 15 },
  { name: "Estructura", sequenceOrder: 3, progressPercentage: 20 },
  { name: "Mampostería", sequenceOrder: 4, progressPercentage: 10 },
  { name: "Instalaciones", sequenceOrder: 5, progressPercentage: 15 },
  { name: "Revoques y contrapisos", sequenceOrder: 6, progressPercentage: 10 },
  { name: "Terminaciones", sequenceOrder: 7, progressPercentage: 15 },
  { name: "Entrega", sequenceOrder: 8, progressPercentage: 10 }
] as const;
