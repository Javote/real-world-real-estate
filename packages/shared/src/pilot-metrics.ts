import { z } from "zod";
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
