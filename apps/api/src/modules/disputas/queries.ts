import type { DisputeOutcome, DisputeStatus } from "@plataforma/shared";
import type { Ejecutor } from "../../platform/audit.js";

const COLUMNAS = [
  "id",
  "stageId",
  "projectId",
  "openedById",
  "reason",
  "status",
  "outcome",
  "resolution",
  "resolvedById",
  "createdAt",
  "resolvedAt"
] as const;

export type FilaDeDisputa = NonNullable<Awaited<ReturnType<typeof disputaPorId>>>;

export const disputaPorId = (e: Ejecutor, id: string) =>
  e.selectFrom("Dispute").select(COLUMNAS).where("id", "=", id).executeTakeFirst();

export function delProyecto(e: Ejecutor, projectId: string, status: DisputeStatus | undefined) {
  let consulta = e
    .selectFrom("Dispute")
    .select(COLUMNAS)
    .where("projectId", "=", projectId)
    .orderBy("createdAt", "desc")
    .orderBy("id", "desc");
  if (status) consulta = consulta.where("status", "=", status);
  return consulta.execute();
}

/** El proyecto del stage: la guarda ya probó que existe y que el usuario es parte. */
export const proyectoDelStage = (e: Ejecutor, stageId: string) =>
  e.selectFrom("Stage").select("projectId").where("id", "=", stageId).executeTakeFirstOrThrow();

export const insertar = (
  e: Ejecutor,
  fila: {
    id: string;
    stageId: string;
    projectId: string;
    openedById: string;
    reason: string;
    createdAt: Date;
  }
) =>
  e
    .insertInto("Dispute")
    .values({ ...fila, status: "Open", outcome: null, resolution: null, resolvedById: null })
    .returning(COLUMNAS);

/**
 * Hubo una liberación en el stage de la disputa: algún `PaymentAttestation` de un contrato del
 * proyecto con el número del stage (`stageNumber` es `Stage.sequenceOrder`).
 */
export async function huboLiberacion(e: Ejecutor, stageId: string) {
  const fila = await e
    .selectFrom("Stage")
    .innerJoin("Unit", "Unit.projectId", "Stage.projectId")
    .innerJoin("Contract", "Contract.unitId", "Unit.id")
    .innerJoin("PaymentAttestation", (join) =>
      join
        .onRef("PaymentAttestation.contractId", "=", "Contract.id")
        .onRef("PaymentAttestation.stageNumber", "=", "Stage.sequenceOrder")
    )
    .select("PaymentAttestation.id")
    .where("Stage.id", "=", stageId)
    .executeTakeFirst();
  return fila !== undefined;
}

/** El reclamo de la resolución, sin ejecutar: solo una `Open` se resuelve, y una sola vez. */
export const reclamarResolucion = (
  e: Ejecutor,
  resolucion: {
    id: string;
    outcome: DisputeOutcome;
    resolution: string;
    resolvedById: string;
    resolvedAt: Date;
  }
) =>
  e
    .updateTable("Dispute")
    .set({
      status: "Resolved",
      outcome: resolucion.outcome,
      resolution: resolucion.resolution,
      resolvedById: resolucion.resolvedById,
      resolvedAt: resolucion.resolvedAt
    })
    .where("id", "=", resolucion.id)
    .where("status", "=", "Open")
    .returning(COLUMNAS);

/** Cuántas disputas se abrieron, sea cual sea su desenlace, en los proyectos dados o en todos. */
export async function cantidadDeDisputas(e: Ejecutor, projectIds: readonly string[] | undefined) {
  let consulta = e.selectFrom("Dispute").select((eb) => eb.fn.countAll<number>().as("cantidad"));
  if (projectIds) consulta = consulta.where("projectId", "in", projectIds);
  return Number((await consulta.executeTakeFirstOrThrow()).cantidad);
}

/** Cuántas liberaciones (`PaymentAttestation`) hubo: el denominador de `disputeRate`. */
export async function cantidadDeLiberaciones(
  e: Ejecutor,
  projectIds: readonly string[] | undefined
) {
  let consulta = e
    .selectFrom("PaymentAttestation")
    .innerJoin("Contract", "Contract.id", "PaymentAttestation.contractId")
    .innerJoin("Unit", "Unit.id", "Contract.unitId")
    .select((eb) => eb.fn.countAll<number>().as("cantidad"));
  if (projectIds) consulta = consulta.where("Unit.projectId", "in", projectIds);
  return Number((await consulta.executeTakeFirstOrThrow()).cantidad);
}
