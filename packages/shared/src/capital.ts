import { z } from "zod";

// Capital del developer (M2-D5 filas 42-43) — **M3-BE-11**.
//
// **Nada de esto es plata que se mueva** (D-021): son los montos DECLARADOS en
// los contratos y en las liberaciones registradas. La plataforma no custodia ni
// transfiere; "capital levantado" significa "suma de los contratos firmados",
// no "fondos recibidos".
//
// Todo en unidades mínimas enteras (regla 1). El cliente formatea con `Intl`.

export const capitalSummarySchema = z.strictObject({
  /** Suma de los contratos firmados. */
  raisedMinorUnits: z.number().int().nonnegative(),
  /** Suma de las liberaciones registradas. */
  releasedMinorUnits: z.number().int().nonnegative(),
  /** `raised - released`. Lo comprometido y todavía no liberado. */
  pendingMinorUnits: z.number().int().nonnegative(),
  contracts: z.number().int().nonnegative(),
  /**
   * Moneda única de los contratos, o `null` si conviven varias. **No se
   * convierte nada**: sumar monedas distintas con una cotización inventada
   * sería afirmar algo que no podemos sustanciar.
   */
  currency: z.string().nullable()
});
export type CapitalSummary = z.infer<typeof capitalSummarySchema>;

export const capitalMonthlyPointSchema = z.strictObject({
  /** `YYYY-MM`, en UTC (regla 1). */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  raisedMinorUnits: z.number().int().nonnegative(),
  releasedMinorUnits: z.number().int().nonnegative()
});
export type CapitalMonthlyPoint = z.infer<typeof capitalMonthlyPointSchema>;

export const capitalByProjectSchema = z.strictObject({
  projectId: z.string(),
  projectName: z.string(),
  raisedMinorUnits: z.number().int().nonnegative(),
  releasedMinorUnits: z.number().int().nonnegative(),
  unitsSold: z.number().int().nonnegative(),
  totalUnits: z.number().int().nonnegative(),
  currency: z.string().nullable()
});
export type CapitalByProject = z.infer<typeof capitalByProjectSchema>;

/** Directorio de investors del developer (fila 48) — **M3-BE-15**. */
export const investorDirectoryEntrySchema = z.strictObject({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  units: z.number().int().nonnegative(),
  investedMinorUnits: z.number().int().nonnegative(),
  currency: z.string().nullable(),
  projects: z.array(z.string())
});
export type InvestorDirectoryEntry = z.infer<typeof investorDirectoryEntrySchema>;
