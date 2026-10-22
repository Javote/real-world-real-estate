import type { DossierId, DossierStatus, ProjectId, UnitId } from "@plataforma/shared";
import type { Database } from "../../db/types.js";
import { ultimoBundlePorStage } from "../../domain/stage-transition.js";
import type { ExpressionBuilder } from "../../lib/kysely.js";
import type { Ejecutor } from "../../platform/audit.js";
import type { Insumos } from "./rules.js";

/** La fila del dossier con lo que se muestra de su unidad y su proyecto. */
function filasDeDossier(e: Ejecutor) {
  return e
    .selectFrom("Dossier")
    .innerJoin("Unit", "Unit.id", "Dossier.unitId")
    .innerJoin("Project", "Project.id", "Unit.projectId")
    .leftJoin("User", "User.id", "Unit.investorId")
    .select([
      "Dossier.id as id",
      "Dossier.status as status",
      "Dossier.masterHash as masterHash",
      "Dossier.compiledAt as compiledAt",
      "Dossier.shareToken as shareToken",
      "Dossier.signedAt as signedAt",
      "Dossier.rejectionNote as rejectionNote",
      "Unit.id as unitId",
      "Unit.unitReference as unitReference",
      "Unit.investorId as investorId",
      "User.fullName as investorName",
      "Project.id as projectId",
      "Project.name as projectName"
    ])
    .$narrowType<{ id: DossierId; unitId: UnitId; projectId: ProjectId; status: DossierStatus }>();
}

export type FilaDeDossier = NonNullable<Awaited<ReturnType<typeof dossierPorId>>>;

export const dossierPorId = (e: Ejecutor, id: string) =>
  filasDeDossier(e).where("Dossier.id", "=", id).executeTakeFirst();

export const dossierDeLaUnidad = (e: Ejecutor, unitId: string) =>
  filasDeDossier(e).where("Dossier.unitId", "=", unitId).executeTakeFirst();

export const dossierPorToken = (e: Ejecutor, shareToken: string) =>
  filasDeDossier(e).where("Dossier.shareToken", "=", shareToken).executeTakeFirst();

/** Los que pueden estar esperando al notary: los `compiled` y los `rejected`, que vuelven si cambiaron. */
export const candidatosALaCola = (e: Ejecutor) =>
  filasDeDossier(e)
    .where("Dossier.status", "in", ["compiled", "rejected"])
    .orderBy("Dossier.compiledAt", "asc")
    .execute();

export async function firmadosPorNotary(e: Ejecutor, notaryId: string | null) {
  let query = e
    .selectFrom("Dossier")
    .select((eb) => eb.fn.countAll<number>().as("cantidad"))
    .where("status", "=", "signed");
  if (notaryId) query = query.where("signedById", "=", notaryId);
  return Number((await query.executeTakeFirstOrThrow()).cantidad);
}

/** Lo que compromete el dossier de cada unidad, en tres consultas para cualquier cantidad de unidades. */
export async function insumosDe(
  e: Ejecutor,
  unidades: { unitId: string; projectId: string }[]
): Promise<Map<string, Insumos>> {
  if (unidades.length === 0) return new Map();
  const proyectos = [...new Set(unidades.map((u) => u.projectId))];
  const unitIds = unidades.map((u) => u.unitId);

  const [stages, evidencia, releases] = await Promise.all([
    e
      .selectFrom("Stage")
      .leftJoin(ultimoBundlePorStage, "EvidenceBundle.stageId", "Stage.id")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.stageId", "=", "Stage.id")
          .on("OnChainEvent.eventType", "=", "STAGE_TRANSITION")
          .on("OnChainEvent.toState", "=", "Completed")
      )
      .select([
        "Stage.id as id",
        "Stage.projectId as projectId",
        "Stage.name as name",
        "EvidenceBundle.commitmentHash as commitmentHash",
        "OnChainEvent.txid as txid"
      ])
      .where("Stage.projectId", "in", proyectos)
      .orderBy("Stage.sequenceOrder", "asc")
      .execute(),
    e
      .selectFrom("Evidence")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.evidenceId", "=", "Evidence.id")
          .on("OnChainEvent.eventType", "=", "EVIDENCE_ANCHOR")
      )
      .select([
        "Evidence.id as id",
        "Evidence.projectId as projectId",
        "Evidence.originalFilename as filename",
        "Evidence.sha256Hash as sha256Hash",
        "OnChainEvent.txid as txid"
      ])
      .where("Evidence.projectId", "in", proyectos)
      .orderBy("Evidence.uploadedAt", "asc")
      .execute(),
    e
      .selectFrom("PaymentAttestation")
      .innerJoin("Contract", "Contract.id", "PaymentAttestation.contractId")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.referenceId", "=", "PaymentAttestation.id")
          .on("OnChainEvent.eventType", "=", "PAYMENT_RELEASE")
      )
      .select([
        "PaymentAttestation.id as id",
        "Contract.unitId as unitId",
        "PaymentAttestation.stageNumber as stageNumber",
        "OnChainEvent.commitment as commitment",
        "OnChainEvent.txid as txid"
      ])
      .where("Contract.unitId", "in", unitIds)
      .orderBy("PaymentAttestation.stageNumber", "asc")
      .execute()
  ]);

  return new Map(
    unidades.map(({ unitId, projectId }) => [
      unitId,
      {
        stages: stages.filter((s) => s.projectId === projectId),
        evidencia: evidencia.filter((ev) => ev.projectId === projectId),
        releases: releases.filter((r) => r.unitId === unitId)
      }
    ])
  );
}

export const eventoDeFirma = (e: Ejecutor, dossierId: string) =>
  e
    .selectFrom("OnChainEvent")
    .selectAll()
    .where("referenceId", "=", dossierId)
    .where("eventType", "=", "DOSSIER_SIGNATURE")
    .executeTakeFirst();

/** El reclamo de la firma: lo gana uno solo, y solo si el dossier sigue esperando al notary. */
export const reclamarFirma = (
  e: Ejecutor,
  firma: { dossierId: string; masterHash: string; notaryId: string; ahora: Date }
) =>
  e
    .updateTable("Dossier")
    .set({
      status: "signed",
      masterHash: firma.masterHash,
      compiledAt: firma.ahora,
      signedById: firma.notaryId,
      signedAt: firma.ahora,
      rejectionNote: null
    })
    .where("id", "=", firma.dossierId)
    .where((eb) => esperandoAlNotary(eb, firma.masterHash))
    .returning("id")
    .executeTakeFirst();

/** El reclamo del rechazo, sin ejecutar: va primero en el `enLote` que lleva su audit. */
export const reclamarRechazo = (
  e: Ejecutor,
  rechazo: { dossierId: string; masterHash: string; nota: string }
) =>
  e
    .updateTable("Dossier")
    .set({ status: "rejected", masterHash: rechazo.masterHash, rejectionNote: rechazo.nota })
    .where("id", "=", rechazo.dossierId)
    .where((eb) => esperandoAlNotary(eb, rechazo.masterHash))
    .returning("id");

// El mismo `esperaAlNotary` de rules.ts, escrito en SQL para que el reclamo lo vuelva a mirar.
function esperandoAlNotary(eb: ExpressionBuilder<Database, "Dossier">, hashActual: string) {
  return eb.or([
    eb("status", "=", "compiled"),
    eb.and([eb("status", "=", "rejected"), eb("masterHash", "!=", hashActual)])
  ]);
}

/** El token, solo si todavía no tiene uno: dos pedidos a la vez comparten el mismo link. */
export const reclamarToken = (e: Ejecutor, dossierId: string, token: string) =>
  e
    .updateTable("Dossier")
    .set({ shareToken: token })
    .where("id", "=", dossierId)
    .where("shareToken", "is", null)
    .returning("id");

export function firmas(
  e: Ejecutor,
  filtro: { limit: number; cursor: string | undefined; signedById: string | null }
) {
  let query = e
    .selectFrom("Dossier")
    .innerJoin("Unit", "Unit.id", "Dossier.unitId")
    .innerJoin("Project", "Project.id", "Unit.projectId")
    .leftJoin("OnChainEvent", (join) =>
      join
        .onRef("OnChainEvent.referenceId", "=", "Dossier.id")
        .on("OnChainEvent.eventType", "=", "DOSSIER_SIGNATURE")
    )
    .select([
      "Dossier.id as dossierId",
      "Dossier.masterHash as masterHash",
      "Dossier.signedAt as signedAt",
      "Unit.unitReference as unitReference",
      "Project.name as projectName",
      "OnChainEvent.txid as signatureTxid"
    ])
    .where("Dossier.status", "=", "signed")
    .orderBy("Dossier.signedAt", "desc")
    .limit(filtro.limit)
    .$narrowType<{ dossierId: DossierId }>();

  if (filtro.signedById) query = query.where("Dossier.signedById", "=", filtro.signedById);
  if (filtro.cursor) {
    query = query.where("Dossier.signedAt", "<", new Date(filtro.cursor).getTime());
  }
  return query.execute();
}
