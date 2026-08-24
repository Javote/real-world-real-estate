import { z } from "zod";

// Las respuestas de los cuatro paneles de rol (M2-D5 filas 02, 33-34, 51, 55).
//
// El schema va acá **antes** que el endpoint (regla 6), y de acá saldrá el
// cliente cuando entre oRPC (D-066). Hoy la API los usa para tipar sus
// respuestas y el front para consumirlas: el drift ya es imposible.
//
// **Los KPI que hoy no se pueden calcular son `null`, no cero.** La diferencia
// importa: cero es una afirmación ("no hay unidades vendidas") y `null` es la
// verdad ("no existe la entidad `Unit` todavía"). Un panel que muestra 0
// unidades donde no hay modelo de unidades está mintiendo con precisión
// decimal. El front los renderiza con el guión de `panel.emptyValue`.

/** KPI que puede no ser calculable todavía por falta de una entidad. */
const kpiPendiente = z.number().int().nonnegative().nullable();

export const developerKpisSchema = z.strictObject({
  activeProjects: z.number().int().nonnegative(),
  /** Necesita `Unit`, que no existe (D-029: nace en la subdivisión). */
  totalUnits: kpiPendiente,
  /** Necesita `Contract`. En unidades mínimas enteras cuando exista (regla 1). */
  capitalRaisedMinorUnits: kpiPendiente,
  /** Porcentaje 0-100 de stages completados sobre el total. */
  averageProgress: z.number().int().min(0).max(100),
  /** Evidencia con anclaje confirmado. */
  verifiedDocuments: z.number().int().nonnegative()
});
export type DeveloperKpis = z.infer<typeof developerKpisSchema>;

export const certifierKpisSchema = z.strictObject({
  assigned: z.number().int().nonnegative(),
  certified: z.number().int().nonnegative(),
  observed: z.number().int().nonnegative(),
  totalStages: z.number().int().nonnegative()
});
export type CertifierKpis = z.infer<typeof certifierKpisSchema>;

export const certifierAssignmentSchema = z.strictObject({
  stageId: z.string(),
  projectName: z.string(),
  stageName: z.string(),
  sequenceOrder: z.number().int().positive()
});
export type CertifierAssignment = z.infer<typeof certifierAssignmentSchema>;

/**
 * KPIs del notary. **Los cuatro son `null` hoy**: el dossier es una entidad que
 * no existe (M2-D4 P8) y sin ella no hay nada que contar. El panel se dibuja
 * igual, con su empty-state — que es lo que un notario vería el primer día.
 */
export const notaryKpisSchema = z.strictObject({
  pendingDossiers: kpiPendiente,
  verified: kpiPendiente,
  signed: kpiPendiente,
  unitsUnderReview: kpiPendiente
});
export type NotaryKpis = z.infer<typeof notaryKpisSchema>;

export const pendingDossierSchema = z.strictObject({
  dossierId: z.string(),
  unitLabel: z.string(),
  investorName: z.string(),
  /** Completitud 0-100: cuánta de la evidencia esperada ya está anclada. */
  completeness: z.number().int().min(0).max(100)
});
export type PendingDossier = z.infer<typeof pendingDossierSchema>;

/** Resumen de proyecto para la superficie Buy del investor (fila 02). */
export const projectSummarySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  status: z.string(),
  /** Porcentaje 0-100 de avance de obra. */
  progress: z.number().int().min(0).max(100),
  /** Necesita `Unit` y su precio. */
  fromPriceMinorUnits: kpiPendiente,
  currency: z.string().nullable()
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
