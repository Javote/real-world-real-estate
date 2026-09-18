import { createHash } from "node:crypto";
import type { Dossier, DossierArtifact, DossierStatus } from "@plataforma/shared";
import { createId } from "../db/id";
import { db } from "../lib/db";
import { reconciliarParaLectura } from "./reconcile";

// Compilación del dossier (M2-D4 P8, M2-D5 filas 26-29) — **M3-BE-12**.
//
// M2-D5 §3: *"Dossier compilation is on-demand from authoritative back-end
// state. The dossier hash is computed at the moment of fetch and is stable as
// long as the underlying anchored artifacts have not changed"*. Así que acá NO
// hay un hash guardado que se sirva: se recompone la lista de artefactos y se
// rehashea en cada lectura. Si el hash cambió, cambió lo que compromete — que
// es exactamente lo que el patrón P8 promete y lo único que puede sostener.
//
// **Una vez firmado, el dossier se congela.** Recomputar el hash de algo que un
// notario ya firmó dejaría la firma apuntando a un hash que ya no existe: la
// prueba se rompería en silencio, que es el peor modo de falla posible acá
// (regla 17). Firmado, `masterHash` es el que se firmó y no se toca.

/** SHA-256 de la lista canónica. El orden es parte del compromiso. */
export function masterHashOf(artifacts: DossierArtifact[]): string {
  const canonico = JSON.stringify(
    artifacts.map((a) => [a.kind, a.referenceId, a.sha256 ?? "", a.txid ?? ""])
  );
  return createHash("sha256").update(canonico).digest("hex");
}

export interface CompiledDossier extends Dossier {
  /** Sirve para el aislamiento cross-rol: el investor solo ve SU unidad. */
  investorId: string | null;
}

/**
 * Reúne los artefactos de una unidad y devuelve el dossier compilado,
 * persistiendo la fila que le da identidad (id y `shareToken` estables entre
 * lecturas). Devuelve `null` si la unidad no existe.
 */
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

  // ── Stages: su prueba es la transición a `Completed`, y su huella el Merkle
  // root del bundle que se ancló al completarlos.
  const stages = await db
    .selectFrom("Stage")
    .leftJoin("EvidenceBundle", "EvidenceBundle.stageId", "Stage.id")
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

  // ── Evidencia: su huella es el SHA-256 de los bytes guardados, y su prueba
  // el TXID del anclaje de ese archivo.
  //
  // **Nunca `storagePath`** (D-011) y **nunca el nombre del archivo en la
  // cadena** (regla 2). El `label` es de presentación y viaja off-chain: acá
  // sí es el nombre original, porque el dossier es un artefacto para leer.
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

  // ── Liberaciones: la prueba financiera por release del patrón P10. Se
  // encuentran por `referenceId`, que es el id del propio release.
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

  // **Completitud = cuántas piezas pueden mostrar un TXID.** No es "cuán listo
  // está el dossier": es cuánta de su prueba está sustanciada (regla 17).
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
    // SPEC-202 (B-02): `Dossier_unitId_key` es único, así que dos
    // compilaciones concurrentes de la misma unidad ya no pueden insertar dos
    // filas — la segunda choca y `onConflict().doNothing()` la absorbe. Pero
    // eso deja a esa segunda llamada sin la fila que acaba de "insertar": hay
    // que releerla, y la que gana la carrera es la que vale para las dos
    // (invariante 2).
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
    // Recompilar solo lo no firmado. Ver el comentario de arriba.
    fila = await db
      .updateTable("Dossier")
      .set({ masterHash: hashCalculado, compiledAt: ahora })
      .where("id", "=", fila.id)
      .returningAll()
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
    // Sin TXID el estado es "Pendiente", nunca "Verificado" (regla 17).
    signatureTxid: firma?.txid ?? null,
    signedAt: fila.signedAt ? new Date(fila.signedAt) : null,
    rejectionNote: fila.rejectionNote
  };
}
