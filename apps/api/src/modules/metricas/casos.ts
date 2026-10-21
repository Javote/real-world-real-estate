import type { DocumentCompleteness } from "@plataforma/shared";
import type { Contexto } from "../../platform/contexto.js";
import * as q from "./queries.js";
import { promedio, tasa } from "./rules.js";

type Deps = Pick<Contexto, "db">;

/** SPEC-504: el estado de hoy, no una foto histórica. Una unidad sin comprador no entra. */
export async function completitud(
  deps: Deps,
  projectId: string | undefined
): Promise<DocumentCompleteness> {
  const unidades = await q.criticosPorUnidadVendida(deps.db, projectId);
  const perUnit = unidades.map((u) => ({ ...u, rate: tasa(u.completedRequired, u.totalRequired) }));
  return { perUnit, overallRate: promedio(perUnit.map((u) => u.rate)) };
}
