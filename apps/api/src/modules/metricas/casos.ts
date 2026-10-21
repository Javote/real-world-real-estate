import type { DocumentCompleteness, PilotMetrics, PilotMetricsReport } from "@plataforma/shared";
import type { Contexto } from "../../platform/contexto.js";
import { tasaDeDisputas } from "../disputas/casos.js";
import { resumen as resumenNps } from "../encuestas/casos.js";
import * as q from "./queries.js";
import { promedio, tasa } from "./rules.js";

type Deps = Pick<Contexto, "db">;
type Proyectos = readonly string[] | undefined;

/** SPEC-504: el estado de hoy, no una foto histórica. Una unidad sin comprador no entra. */
export async function completitud(
  deps: Deps,
  projectIds: Proyectos
): Promise<DocumentCompleteness> {
  const unidades = await q.criticosPorUnidadVendida(deps.db, projectIds);
  const perUnit = unidades.map((u) => ({ ...u, rate: tasa(u.completedRequired, u.totalRequired) }));
  return { perUnit, overallRate: promedio(perUnit.map((u) => u.rate)) };
}

async function metricasDe(deps: Deps, projectIds: Proyectos): Promise<PilotMetrics> {
  const [firmados, bundles, valor, documentacion, disputas, nps] = await Promise.all([
    q.contratosFirmados(deps.db, projectIds),
    q.bundles(deps.db, projectIds),
    q.valorDeclarado(deps.db, projectIds),
    completitud(deps, projectIds),
    tasaDeDisputas(deps, projectIds),
    resumenNps(deps, projectIds)
  ]);
  return {
    signedContractsCount: firmados,
    evidenceBundlesCount: bundles,
    releasesCount: disputas.releases,
    uniqueWalletsCount: null,
    declaredValueByCurrency: valor,
    documentCompletenessRate: documentacion.overallRate,
    disputesCount: disputas.disputes,
    disputeRate: disputas.rate,
    nps
  };
}

/**
 * SPEC-501: cada número se calcula al leer, sin tabla ni caché. El total se calcula aparte, no sumando
 * los proyectos: una tasa no se suma.
 */
export async function piloto(deps: Deps, projectIds: Proyectos): Promise<PilotMetricsReport> {
  const elegidos = await q.proyectos(deps.db, projectIds);
  const [total, ...porProyecto] = await Promise.all([
    metricasDe(deps, projectIds),
    ...elegidos.map((p) => metricasDe(deps, [p.id]))
  ]);
  return {
    total: total!,
    perProject: elegidos.map((p, i) => ({
      projectId: p.id,
      projectName: p.name,
      ...porProyecto[i]!
    }))
  };
}
