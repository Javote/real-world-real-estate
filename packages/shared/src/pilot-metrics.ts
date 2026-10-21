import { z } from "zod";
import { npsSummarySchema } from "./nps";
import { cuidParamSchema } from "./params";

// Las métricas del piloto (M4, criterio 1): se calculan al leer, nunca se guardan (SPEC-501).

/** Una proporción de 0 a 1, o `null` cuando no hay denominador: sin datos no es 0. */
const tasa = z.number().min(0).max(1).nullable();
const cantidad = z.number().int().nonnegative();

export const documentCompletenessQuerySchema = z.strictObject({
  projectId: cuidParamSchema.optional()
});
export type DocumentCompletenessQuery = z.infer<typeof documentCompletenessQuerySchema>;

/** Una unidad vendida: de los stages críticos de su proyecto (D-028), cuántos están `Completed`. */
export const unitCompletenessSchema = z.strictObject({
  unitId: z.string(),
  completedRequired: cantidad,
  totalRequired: cantidad,
  rate: tasa
});
export type UnitCompleteness = z.infer<typeof unitCompletenessSchema>;

export const documentCompletenessSchema = z.strictObject({
  perUnit: z.array(unitCompletenessSchema),
  /** Promedio simple de `rate` entre las unidades vendidas que tienen stages críticos. */
  overallRate: tasa
});
export type DocumentCompleteness = z.infer<typeof documentCompletenessSchema>;

/** `?projectIds=a,b`: ids separados por coma, sin espacios. Sin filtro, todos los proyectos. */
export const pilotMetricsQuerySchema = z.strictObject({
  projectIds: z
    .string()
    .regex(/^[a-z][a-z0-9]{23}(,[a-z][a-z0-9]{23})*$/, "No es una lista de ids")
    .optional()
});
export type PilotMetricsQuery = z.infer<typeof pilotMetricsQuerySchema>;

/** Lo declarado, por moneda: sumar entre monedas sin una tasa sería un número inventado. */
export const declaredValueSchema = z.strictObject({
  currency: z.string(),
  totalMinorUnits: cantidad
});
export type DeclaredValue = z.infer<typeof declaredValueSchema>;

/** Los ocho números del criterio 1 de M4 (SPEC-501), calculados al leer. */
export const pilotMetricsSchema = z.strictObject({
  signedContractsCount: cantidad,
  evidenceBundlesCount: cantidad,
  releasesCount: cantidad,
  /**
   * Siempre `null` hoy: toda transacción la firma la wallet de servicio (D-078) y `OnChainEvent` no
   * guarda quién firmó. Contar cuentas no es contar wallets.
   */
  uniqueWalletsCount: z.null(),
  declaredValueByCurrency: z.array(declaredValueSchema),
  documentCompletenessRate: tasa,
  disputesCount: cantidad,
  /** Disputas sobre liberaciones (D-104): puede pasar de 1. */
  disputeRate: z.number().nonnegative().nullable(),
  nps: npsSummarySchema
});
export type PilotMetrics = z.infer<typeof pilotMetricsSchema>;

export const projectPilotMetricsSchema = pilotMetricsSchema.extend({
  projectId: z.string(),
  projectName: z.string()
});
export type ProjectPilotMetrics = z.infer<typeof projectPilotMetricsSchema>;

export const pilotMetricsReportSchema = z.strictObject({
  total: pilotMetricsSchema,
  perProject: z.array(projectPilotMetricsSchema)
});
export type PilotMetricsReport = z.infer<typeof pilotMetricsReportSchema>;
