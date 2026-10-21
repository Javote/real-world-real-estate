import type { Ejecutor } from "../../platform/audit.js";

type Proyectos = readonly string[] | undefined;

/**
 * Por unidad vendida, los stages críticos de su proyecto (D-028) y cuántos están `Completed` hoy. Los
 * stages son del proyecto (D-029): todas las unidades de un proyecto comparten denominador.
 */
export async function criticosPorUnidadVendida(e: Ejecutor, projectIds: Proyectos) {
  let consulta = e
    .selectFrom("Unit")
    .leftJoin("Stage", (join) =>
      join.onRef("Stage.projectId", "=", "Unit.projectId").on("Stage.validationCritical", "=", true)
    )
    .select((eb) => [
      "Unit.id as unitId",
      eb.fn.count<number>("Stage.id").as("totalRequired"),
      eb.fn
        .count<number>(eb.case().when("Stage.state", "=", "Completed").then(1).end())
        .as("completedRequired")
    ])
    .where("Unit.investorId", "is not", null)
    .groupBy("Unit.id")
    .orderBy("Unit.projectId")
    .orderBy("Unit.unitReference");
  if (projectIds) consulta = consulta.where("Unit.projectId", "in", projectIds);

  const filas = await consulta.execute();
  return filas.map((f) => ({
    unitId: f.unitId,
    totalRequired: Number(f.totalRequired),
    completedRequired: Number(f.completedRequired)
  }));
}

export function proyectos(e: Ejecutor, projectIds: Proyectos) {
  let consulta = e.selectFrom("Project").select(["id", "name"]).orderBy("name").orderBy("id");
  if (projectIds) consulta = consulta.where("id", "in", projectIds);
  return consulta.execute();
}

export async function contratosFirmados(e: Ejecutor, projectIds: Proyectos) {
  let consulta = e
    .selectFrom("Contract")
    .innerJoin("Unit", "Unit.id", "Contract.unitId")
    .select((eb) => eb.fn.countAll<number>().as("cantidad"))
    .where("Contract.signedAt", "is not", null);
  if (projectIds) consulta = consulta.where("Unit.projectId", "in", projectIds);
  return Number((await consulta.executeTakeFirstOrThrow()).cantidad);
}

export async function bundles(e: Ejecutor, projectIds: Proyectos) {
  let consulta = e
    .selectFrom("EvidenceBundle")
    .select((eb) => eb.fn.countAll<number>().as("cantidad"));
  if (projectIds) consulta = consulta.where("projectId", "in", projectIds);
  return Number((await consulta.executeTakeFirstOrThrow()).cantidad);
}

/** La suma de los contratos, por moneda y sin convertir. */
export async function valorDeclarado(e: Ejecutor, projectIds: Proyectos) {
  let consulta = e
    .selectFrom("Contract")
    .innerJoin("Unit", "Unit.id", "Contract.unitId")
    .select((eb) => [
      "Contract.currency as currency",
      eb.fn.sum<number>("Contract.totalMinorUnits").as("totalMinorUnits")
    ])
    .groupBy("Contract.currency")
    .orderBy("Contract.currency");
  if (projectIds) consulta = consulta.where("Unit.projectId", "in", projectIds);
  const filas = await consulta.execute();
  return filas.map((f) => ({ currency: f.currency, totalMinorUnits: Number(f.totalMinorUnits) }));
}
