import type { Ejecutor } from "../../platform/audit.js";

/**
 * Por unidad vendida, los stages críticos de su proyecto (D-028) y cuántos están `Completed` hoy. Los
 * stages son del proyecto (D-029): todas las unidades de un proyecto comparten denominador.
 */
export async function criticosPorUnidadVendida(e: Ejecutor, projectId: string | undefined) {
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
  if (projectId) consulta = consulta.where("Unit.projectId", "=", projectId);

  const filas = await consulta.execute();
  return filas.map((f) => ({
    unitId: f.unitId,
    totalRequired: Number(f.totalRequired),
    completedRequired: Number(f.completedRequired)
  }));
}
