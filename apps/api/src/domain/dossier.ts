import { createHash } from "node:crypto";
import type { Dossier, DossierArtifact, DossierStatus } from "@plataforma/shared";
import { createId } from "../db/id.js";
import { db } from "../lib/db.js";
import { reconciliarParaLectura } from "./reconcile.js";
import { ultimoBundlePorStage } from "./stage-transition.js";

// El orden de los artefactos es parte del compromiso.
export function masterHashOf(artifacts: DossierArtifact[]): string {
  const canonico = JSON.stringify(
    artifacts.map((a) => [a.kind, a.referenceId, a.sha256 ?? "", a.txid ?? ""])
  );
  return createHash("sha256").update(canonico).digest("hex");
}

export interface CompiledDossier extends Dossier {
  investorId: string | null;
}

export async function compileDossier(unitId: string): Promise<CompiledDossier | null> {
  const unidad = await db
    .selectFrom("Unit")
    .innerJoin("Project", "Project.id", "Unit.projectId")
    .select([
      "Unit.id as id",
      "Unit.unitReference as unitReference",
      "Unit.investorId as investorId",
      "Project.id as projectId",
      "Project.name as projectName"
    ])
    .where("Unit.id", "=", unitId)
    .executeTakeFirst();

  if (!unidad) return null;

  const stages = await db
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
      "Stage.name as name",
      "Stage.sequenceOrder as sequenceOrder",
      "EvidenceBundle.commitmentHash as commitmentHash",
      "OnChainEvent.txid as txid"
    ])
    .where("Stage.projectId", "=", unidad.projectId)
    .orderBy("Stage.sequenceOrder", "asc")
    .execute();

  const evidencia = await db
    .selectFrom("Evidence")
    .leftJoin("OnChainEvent", (join) =>
      join
        .onRef("OnChainEvent.evidenceId", "=", "Evidence.id")
        .on("OnChainEvent.eventType", "=", "EVIDENCE_ANCHOR")
    )
    .select([
      "Evidence.id as id",
      "Evidence.originalFilename as filename",
      "Evidence.sha256Hash as sha256Hash",
      "OnChainEvent.txid as txid"
    ])
    .where("Evidence.projectId", "=", unidad.projectId)
    .orderBy("Evidence.uploadedAt", "asc")
    .execute();

  const releases = await db
    .selectFrom("PaymentAttestation")
    .innerJoin("Contract", "Contract.id", "PaymentAttestation.contractId")
    .leftJoin("OnChainEvent", (join) =>
      join
        .onRef("OnChainEvent.referenceId", "=", "PaymentAttestation.id")
        .on("OnChainEvent.eventType", "=", "PAYMENT_RELEASE")
    )
    .select([
      "PaymentAttestation.id as id",
      "PaymentAttestation.stageNumber as stageNumber",
      "OnChainEvent.commitment as commitment",
      "OnChainEvent.txid as txid"
    ])
    .where("Contract.unitId", "=", unidad.id)
    .orderBy("PaymentAttestation.stageNumber", "asc")
    .execute();

  const artifacts: DossierArtifact[] = [
    ...stages.map((s) => ({
      kind: "stage" as const,
      referenceId: s.id,
      label: s.name,
      sha256: s.commitmentHash,
      txid: s.txid
    })),
    ...evidencia.map((e) => ({
      kind: "evidence" as const,
      referenceId: e.id,
      label: e.filename,
      sha256: e.sha256Hash,
      txid: e.txid
    })),
    ...releases.map((r) => ({
      kind: "release" as const,
      referenceId: r.id,
      label: `#${r.stageNumber}`,
      sha256: r.commitment,
      txid: r.txid
    }))
  ];

  const conPrueba = artifacts.filter((a) => a.txid !== null).length;
  const completeness =
    artifacts.length === 0 ? 0 : Math.round((conPrueba / artifacts.length) * 100);

  const hashCalculado = masterHashOf(artifacts);
  const ahora = new Date();

  const existente = await db
    .selectFrom("Dossier")
    .selectAll()
    .where("unitId", "=", unidad.id)
    .executeTakeFirst();

  let fila = existente;

  if (!fila) {
    await db
      .insertInto("Dossier")
      .values({
        id: createId(),
        unitId: unidad.id,
        masterHash: hashCalculado,
        compiledAt: ahora,
        shareToken: null,
        status: "compiled",
        signedById: null,
        signedAt: null,
        rejectionNote: null
      })
      .onConflict((oc) => oc.column("unitId").doNothing())
      .execute();

    fila = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("unitId", "=", unidad.id)
      .executeTakeFirstOrThrow();
  } else if (fila.status !== "signed" && fila.masterHash !== hashCalculado) {
    await db
      .updateTable("Dossier")
      .set({ masterHash: hashCalculado, compiledAt: ahora, status: "compiled" })
      .where("id", "=", fila.id)
      // Nunca pisar una firma: el hash firmado queda congelado.
      .where("status", "!=", "signed")
      .execute();
    fila = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("id", "=", fila.id)
      .executeTakeFirstOrThrow();
  }

  if (fila.status === "signed") await reconciliarParaLectura({ referenceId: fila.id });

  const firma =
    fila.status === "signed"
      ? await db
          .selectFrom("OnChainEvent")
          .select("txid")
          .where("referenceId", "=", fila.id)
          .where("eventType", "=", "DOSSIER_SIGNATURE")
          .executeTakeFirst()
      : undefined;

  return {
    id: fila.id,
    unitId: unidad.id,
    unitReference: unidad.unitReference,
    projectId: unidad.projectId,
    projectName: unidad.projectName,
    investorId: unidad.investorId,
    masterHash: fila.masterHash,
    compiledAt: new Date(fila.compiledAt),
    status: fila.status as DossierStatus,
    artifacts,
    completeness,
    signatureTxid: firma?.txid ?? null,
    signedAt: fila.signedAt ? new Date(fila.signedAt) : null,
    rejectionNote: fila.rejectionNote
  };
}
