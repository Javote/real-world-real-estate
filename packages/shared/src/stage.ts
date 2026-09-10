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
 *
 * **Qué significa cada estado: a quién le toca** (D-020, tabla completa ahí).
 * Los cuatro no son cuatro momentos de la obra — son de quién es el turno, y
 * por eso `Pending` e `InProgress` **no** son redundantes aunque lo parezcan:
 *
 * | Estado       | Espera a  | Afirma                                     |
 * |--------------|-----------|--------------------------------------------|
 * | `Pending`    | developer | declarada y anclada; nada en el registro   |
 * | `InProgress` | certifier | hay evidencia; nadie la juzgó              |
 * | `Observed`   | developer | el certifier encontró un problema          |
 * | `Completed`  | nadie     | cerrada, con el root del bundle en el datum|
 *
 * Se comprueba en `certifier.routes.ts`: `GET /certifier/assignments` filtra
 * `state in (InProgress, Observed)`, así que un stage `Pending` es invisible
 * para el certifier. Su cola arranca donde arranca su turno.
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
 * Body de `PATCH /api/v1/stages/:id`. A diferencia de `stageTransitionSchema`
 * (que mueve la FSM), esto edita metadata del stage — `sequenceOrder` y
 * `validationCritical` son parte de su identidad en el datum, y la ruta
 * bloquea el cambio una vez que el hilo está anclado (ver `stages.routes.ts`).
 */
export const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  sequenceOrder: z.number().int().positive().optional(),
  validationCritical: z.boolean().optional()
});
export type UpdateStageInput = z.infer<typeof updateStageSchema>;

/** Body de `POST /certifier/stages/:id/observe` (fila 57). */
export const observeStageSchema = z.strictObject({ note: z.string().min(1).max(2000) });
export type ObserveStageInput = z.infer<typeof observeStageSchema>;

/**
 * Catálogo normativo de las 10 etapas del "Stage template" (M2-D1 §5.2,
 * captura 34C — `34C-DEVELOPER-NEW-PROJECT-B.png`). Los 10 nombres son los
 * únicos que existen en algún entregable; se transcriben traducidos al
 * español (la captura los trae mezclados en inglés y español), confirmado
 * por el dueño el 2026-09-08.
 *
 * **Sin `progressPercentage`.** Existió como columna nullable (M3 §1.1) pero
 * nunca tuvo call site que lo escribiera ni lo leyera — el avance del
 * proyecto es derivado (`completadas/total`, D-021 relee "signers/percentages
 * configurables" así), no un peso declarado por stage. Columna eliminada
 * 2026-09-10 (migración `0003_drop_stage_progress.sql`).
 */
export interface StageCatalogEntry {
  name: string;
  sequenceOrder: number;
}

export const DEFAULT_STAGE_CATALOG: readonly StageCatalogEntry[] = [
  { name: "Adquisición del terreno", sequenceOrder: 1 },
  { name: "Proyecto ejecutivo", sequenceOrder: 2 },
  { name: "Movimiento de suelos y excavación", sequenceOrder: 3 },
  { name: "Cimentación", sequenceOrder: 4 },
  { name: "Estructura planta baja", sequenceOrder: 5 },
  { name: "Estructura niveles superiores", sequenceOrder: 6 },
  { name: "Cerramientos y mampostería", sequenceOrder: 7 },
  { name: "Instalaciones", sequenceOrder: 8 },
  { name: "Terminaciones", sequenceOrder: 9 },
  { name: "Final de obra y subdivisión", sequenceOrder: 10 }
] as const;

/**
 * `GET /api/v1/stages/:id` y `PATCH /api/v1/stages/:id` devuelven la fila de
 * `Stage` completa (`returningAll()`/`selectAll()`), coercionada por
 * `SqliteTypeCoercionPlugin` — `validationCritical` ya es `boolean`,
 * `certifiedAt`/`createdAt`/`updatedAt` ya son `Date`.
 */
export const stageSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  sequenceOrder: z.number().int().positive(),
  state: stageStateSchema,
  validationCritical: z.boolean(),
  certifiedAt: z.coerce.date().nullable(),
  certifiedById: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type StageResponse = z.infer<typeof stageSchema>;

/**
 * Estado de un evento on-chain. `Pending` mientras no haya TXID confirmado —
 * la regla 17 prohíbe mostrar prueba sin anclaje real. Vive acá (y no en
 * `apps/api/src/db/types.ts`, que la re-exporta) por el mismo motivo que
 * `STAGE_STATES`: el schema Zod de la respuesta la necesita (regla 6).
 */
export const ONCHAIN_EVENT_STATUSES = ["Pending", "Confirmed", "Failed"] as const;
export const onChainEventStatusSchema = z.enum(ONCHAIN_EVENT_STATUSES);
export type OnChainEventStatus = z.infer<typeof onChainEventStatusSchema>;

/**
 * `event_type` de M1-D2 §2 — las seis operaciones on-chain de M2-D5 §7
 * (`M3-SC-01..06`), más los dos eventos del hilo de stages.
 */
export const ONCHAIN_EVENT_TYPES = [
  "STAGE_CREATED",
  "STAGE_TRANSITION",
  "EVIDENCE_ANCHOR",
  "INVITATION_ACCEPTED",
  "PAYMENT_RELEASE",
  "DOSSIER_SIGNATURE",
  "DOCUMENT_ANCHOR"
] as const;
export const onChainEventTypeSchema = z.enum(ONCHAIN_EVENT_TYPES);
export type OnChainEventType = z.infer<typeof onChainEventTypeSchema>;

/**
 * Fila de `OnChainEvent` completa (M1-D2 §2). Sin campos que ocultar: son
 * hashes, refs opacas y timestamps — nunca PII (regla 2). `blockTimestamp`
 * está en `TIMESTAMP_COLUMNS` del plugin (`sqlite-type-plugin.ts`), así que
 * también llega como `Date`.
 */
export const onChainEventSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  stageId: z.string().nullable(),
  evidenceId: z.string().nullable(),
  referenceId: z.string().nullable(),
  eventIndex: z.number().int().nonnegative(),
  eventType: onChainEventTypeSchema,
  fromState: stageStateSchema.nullable(),
  toState: stageStateSchema.nullable(),
  commitment: z.string().nullable(),
  status: onChainEventStatusSchema,
  txid: z.string().nullable(),
  network: z.string().nullable(),
  outputRef: z.string().nullable(),
  blockTimestamp: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});
export type OnChainEventResponse = z.infer<typeof onChainEventSchema>;

/** `POST /api/v1/evidence/reconcile` (`domain/reconcile.ts` → `ResultadoReconciliacion`). */
export const reconciliationResultSchema = z.strictObject({
  revisados: z.number().int().nonnegative(),
  confirmados: z.number().int().nonnegative()
});
export type ReconciliationResult = z.infer<typeof reconciliationResultSchema>;

/**
 * Fila 45 — `GET /developer/progress`: el avance a través de todos los
 * proyectos. `certifiedAt` (del stage) y `estimatedDelivery` (del proyecto)
 * son lo que la captura 45 pide para "Stage Detail" y la etiqueta de
 * finalización del timeline — ninguno de los dos se deriva, se selecciona.
 */
export const developerProgressItemSchema = z.strictObject({
  stageId: z.string(),
  stageName: z.string(),
  sequenceOrder: z.number().int().positive(),
  state: stageStateSchema,
  certifiedAt: z.coerce.date().nullable(),
  projectId: z.string(),
  projectName: z.string(),
  estimatedDelivery: z.coerce.date().nullable()
});
export type DeveloperProgressItem = z.infer<typeof developerProgressItemSchema>;

/** Filas 15-18 — `GET /investor/units/:id/news`: las novedades de la unidad. */
export const unitNewsEventSchema = z.strictObject({
  id: z.string(),
  eventType: onChainEventTypeSchema,
  toState: stageStateSchema.nullable(),
  txid: z.string().nullable(),
  status: onChainEventStatusSchema,
  createdAt: z.coerce.date(),
  stageName: z.string().nullable()
});
export type UnitNewsEvent = z.infer<typeof unitNewsEventSchema>;

/** `GET /projects/:id/stages` (array): el stage con si tiene hilo on-chain. */
export const stageWithThreadSchema = stageSchema.extend({ hasOnChainThread: z.boolean() });
export type StageWithThread = z.infer<typeof stageWithThreadSchema>;

/** Resumen de `EvidenceBundle`, embebido en `GET /projects/:id/stages/:stageId`. */
export const evidenceBundleSummarySchema = z.strictObject({
  id: z.string(),
  commitmentHash: z.string(),
  createdAt: z.coerce.date()
});
export type EvidenceBundleSummary = z.infer<typeof evidenceBundleSummarySchema>;

/**
 * Un evento del hilo, proyectado — mismo endpoint. Sin `id`/`projectId`/
 * `stageId`/`evidenceId`/`referenceId`/`network`/`blockTimestamp`/`updatedAt`:
 * el handler no los selecciona, así que no están en la respuesta real.
 */
export const stageEventSummarySchema = z.strictObject({
  eventType: onChainEventTypeSchema,
  toState: stageStateSchema.nullable(),
  commitment: z.string().nullable(),
  txid: z.string().nullable(),
  status: onChainEventStatusSchema,
  outputRef: z.string().nullable(),
  createdAt: z.coerce.date()
});
export type StageEventSummary = z.infer<typeof stageEventSummarySchema>;
