import { randomBytes } from "node:crypto";
import {
  type Dossier,
  type DossierShare,
  type DossierSignResult,
  err,
  type NotaryKpis,
  ok,
  type PendingDossier,
  type PublicDossier,
  type Result
} from "@plataforma/shared";
import { anchorCommitmentEvent } from "../../domain/anchoring.js";
import { reconciliarParaLectura } from "../../domain/reconcile.js";
import { enLote } from "../../lib/db.js";
import { anclarConReclamo } from "../../platform/anclaje.js";
import { audit, auditSiGano } from "../../platform/audit.js";
import type { Contexto } from "../../platform/contexto.js";
import { notify, notifySiGano } from "../../platform/notify.js";
import { renderTextPdf } from "../../utils/pdf.js";
import * as q from "./queries.js";
import {
  artefactosDe,
  commitmentDeFirma,
  completitud,
  esperaAlNotary,
  estadoVigente,
  type Insumos,
  masterHashDe
} from "./rules.js";

type Deps = Pick<Contexto, "db" | "clock">;

const COLA_MAXIMA = 50;

// Ninguna lectura escribe el dossier (SPEC-615, decisión 2): el hash y el estado vigentes se calculan
// acá. La firma es lo único que fija el `masterHash`.
async function compilado(deps: Deps, fila: q.FilaDeDossier, insumos: Insumos): Promise<Dossier> {
  const artefactos = artefactosDe(insumos);
  const hashActual = masterHashDe(artefactos);
  const firmado = fila.status === "signed";

  if (firmado) await reconciliarParaLectura({ referenceId: fila.id });
  const firma = firmado ? await q.eventoDeFirma(deps.db, fila.id) : undefined;

  return {
    id: fila.id,
    unitId: fila.unitId,
    unitReference: fila.unitReference,
    projectId: fila.projectId,
    projectName: fila.projectName,
    masterHash: firmado ? fila.masterHash : hashActual,
    compiledAt: firmado ? new Date(fila.compiledAt) : deps.clock(),
    status: estadoVigente(fila, hashActual),
    artifacts: artefactos,
    completeness: completitud(artefactos),
    signatureTxid: firma?.txid ?? null,
    signedAt: fila.signedAt ? new Date(fila.signedAt) : null,
    rejectionNote: fila.rejectionNote
  };
}

async function insumosDeUna(deps: Deps, fila: q.FilaDeDossier): Promise<Insumos> {
  const insumos = await q.insumosDe(deps.db, [fila]);
  return insumos.get(fila.unitId)!;
}

async function leer(
  deps: Deps,
  fila: q.FilaDeDossier | undefined
): Promise<Result<Dossier, "NOT_FOUND">> {
  if (!fila) return err("NOT_FOUND");
  return ok(await compilado(deps, fila, await insumosDeUna(deps, fila)));
}

export const leerPorId = async (deps: Deps, dossierId: string) =>
  leer(deps, await q.dossierPorId(deps.db, dossierId));

export const leerDeLaUnidad = async (deps: Deps, unitId: string) =>
  leer(deps, await q.dossierDeLaUnidad(deps.db, unitId));

export async function leerPublico(
  deps: Deps,
  shareToken: string
): Promise<Result<PublicDossier, "NOT_FOUND">> {
  const leido = await leer(deps, await q.dossierPorToken(deps.db, shareToken));
  if (!leido.ok) return leido;
  const d = leido.value;
  return ok({
    unitReference: d.unitReference,
    projectName: d.projectName,
    masterHash: d.masterHash,
    compiledAt: d.compiledAt,
    status: d.status,
    completeness: d.completeness,
    signatureTxid: d.signatureTxid,
    signedAt: d.signedAt,
    artifacts: d.artifacts
  });
}

/** Los que esperan al notary, con el hash vigente de cada uno calculado en lote: sin N+1. */
async function esperandoAlNotary(deps: Deps, filas: q.FilaDeDossier[]) {
  const insumos = await q.insumosDe(deps.db, filas);
  return filas.flatMap((fila) => {
    const artefactos = artefactosDe(insumos.get(fila.unitId)!);
    return esperaAlNotary(fila, masterHashDe(artefactos))
      ? [{ fila, completeness: completitud(artefactos) }]
      : [];
  });
}

export async function cola(deps: Deps): Promise<PendingDossier[]> {
  const pendientes = await esperandoAlNotary(deps, await q.candidatosALaCola(deps.db));
  return pendientes.slice(0, COLA_MAXIMA).map(({ fila, completeness }) => ({
    dossierId: fila.id,
    unitLabel: fila.unitReference,
    /* v8 ignore next -- @preserve: el dossier nace con la venta, así que su unidad tiene investor */
    investorName: fila.investorName ?? fila.unitReference,
    completeness
  }));
}

export async function kpis(deps: Deps, notaryId: string | null): Promise<NotaryKpis> {
  const [candidatos, firmadosTodos, firmadosPropios] = await Promise.all([
    q.candidatosALaCola(deps.db),
    q.firmadosPorNotary(deps.db, null),
    notaryId ? q.firmadosPorNotary(deps.db, notaryId) : null
  ]);
  const pendientes = (await esperandoAlNotary(deps, candidatos)).length;

  return {
    pendingDossiers: pendientes,
    verified: firmadosTodos + candidatos.length - pendientes,
    signed: firmadosPropios ?? firmadosTodos,
    // Un dossier por unidad (índice único de `Dossier.unitId`).
    unitsUnderReview: pendientes
  };
}

export async function firmasDe(
  deps: Deps,
  filtro: { limit: number; cursor: string | undefined; signedById: string | null }
) {
  const filas = await q.firmas(deps.db, filtro);
  const items = filas.map((f) => ({
    dossierId: f.dossierId,
    unitReference: f.unitReference,
    projectName: f.projectName,
    masterHash: f.masterHash,
    signatureTxid: f.signatureTxid,
    // Firmar siempre escribe `signedAt`, y la consulta filtra `status = "signed"`.
    signedAt: new Date(f.signedAt!),
    status: "signed" as const
  }));
  return { items, nextCursor: items.at(-1)?.signedAt.toISOString() ?? null };
}

type Firma = { status: 200 | 201; body: DossierSignResult };

async function firmaExistente(deps: Deps, dossierId: string, masterHash: string): Promise<Firma> {
  await reconciliarParaLectura({ referenceId: dossierId });
  const anchor = await q.eventoDeFirma(deps.db, dossierId);
  return { status: 200, body: { dossierId, masterHash, ...(anchor && { anchor }) } };
}

export async function firmar(
  deps: Deps,
  input: { dossierId: string; notaryId: string }
): Promise<Result<Firma, "NOT_FOUND" | "DOSSIER_NOT_SIGNABLE">> {
  const fila = await q.dossierPorId(deps.db, input.dossierId);
  if (!fila) return err("NOT_FOUND");
  if (fila.status === "signed") return ok(await firmaExistente(deps, fila.id, fila.masterHash));

  const masterHash = masterHashDe(artefactosDe(await insumosDeUna(deps, fila)));
  if (!esperaAlNotary(fila, masterHash)) return err("DOSSIER_NOT_SIGNABLE");

  const ahora = deps.clock();
  const firmado = await anclarConReclamo({
    reclamar: () =>
      q.reclamarFirma(deps.db, { dossierId: fila.id, masterHash, notaryId: input.notaryId, ahora }),
    anclar: () =>
      anchorCommitmentEvent({
        projectId: fila.projectId,
        eventType: "DOSSIER_SIGNATURE",
        commitment: commitmentDeFirma({ dossierId: fila.id, masterHash, signedAt: ahora }),
        reference: fila.id
      })
  });

  if (!firmado) {
    const actual = await q.dossierPorId(deps.db, fila.id);
    if (actual?.status === "signed")
      return ok(await firmaExistente(deps, fila.id, actual.masterHash));
    return err("DOSSIER_NOT_SIGNABLE");
  }

  await enLote(
    audit(deps.db, {
      actorUserId: input.notaryId,
      action: "SIGN_DOSSIER",
      entityType: "Dossier",
      entityId: fila.id,
      metadata: { masterHash, txid: firmado.evento.txid }
    }),
    /* v8 ignore next -- @preserve: el dossier nace con la venta, así que su unidad tiene investor */
    ...(fila.investorId
      ? [
          notify(deps.db, {
            userId: fila.investorId,
            category: "signature",
            titleKey: "notifications.dossier.signed",
            params: { unitReference: fila.unitReference },
            unitId: fila.unitId
          })
        ]
      : [])
  );

  return ok({
    status: 201,
    body: { dossierId: fila.id, masterHash, signedAt: ahora, anchor: firmado.evento }
  });
}

export async function rechazar(
  deps: Deps,
  input: { dossierId: string; notaryId: string; nota: string }
): Promise<
  Result<
    { dossierId: string; status: "rejected" },
    "NOT_FOUND" | "DOSSIER_SIGNED" | "DOSSIER_NOT_REJECTABLE"
  >
> {
  const fila = await q.dossierPorId(deps.db, input.dossierId);
  if (!fila) return err("NOT_FOUND");
  if (fila.status === "signed") return err("DOSSIER_SIGNED");

  const masterHash = masterHashDe(artefactosDe(await insumosDeUna(deps, fila)));
  if (!esperaAlNotary(fila, masterHash)) return err("DOSSIER_NOT_REJECTABLE");

  // Un lote: el reclamo, su audit y el aviso al investor, los dos solo si el reclamo ganó.
  const [reclamado] = await enLote(
    q.reclamarRechazo(deps.db, { dossierId: fila.id, masterHash, nota: input.nota }),
    auditSiGano(deps.db, {
      actorUserId: input.notaryId,
      action: "REJECT_DOSSIER",
      entityType: "Dossier",
      entityId: fila.id,
      metadata: { note: input.nota }
    }),
    /* v8 ignore next -- @preserve: el dossier nace con la venta, así que su unidad tiene investor */
    ...(fila.investorId
      ? [
          notifySiGano(deps.db, {
            userId: fila.investorId,
            category: "signature",
            titleKey: "notifications.dossier.rejected",
            unitId: fila.unitId
          })
        ]
      : [])
  );

  if (reclamado.length === 0) {
    const actual = await q.dossierPorId(deps.db, fila.id);
    return err(actual?.status === "signed" ? "DOSSIER_SIGNED" : "DOSSIER_NOT_REJECTABLE");
  }
  return ok({ dossierId: fila.id, status: "rejected" as const });
}

export async function compartir(
  deps: Deps,
  input: { unitId: string; actorId: string }
): Promise<Result<DossierShare, "NOT_FOUND">> {
  const fila = await q.dossierDeLaUnidad(deps.db, input.unitId);
  if (!fila) return err("NOT_FOUND");
  const dossier = await compilado(deps, fila, await insumosDeUna(deps, fila));

  let token = fila.shareToken;
  if (!token) {
    const nuevo = randomBytes(32).toString("hex");
    const [reclamado] = await enLote(
      q.reclamarToken(deps.db, fila.id, nuevo),
      auditSiGano(deps.db, {
        actorUserId: input.actorId,
        action: "SHARE_DOSSIER",
        entityType: "Dossier",
        entityId: fila.id
      })
    );
    token = reclamado.length > 0 ? nuevo : (await q.dossierPorId(deps.db, fila.id))!.shareToken!;
  }

  return ok({
    shareToken: token,
    path: `/api/v1/public/dossier/${token}`,
    masterHash: dossier.masterHash
  });
}

export async function exportar(
  deps: Deps,
  input: { unitId: string; actorId: string }
): Promise<Result<{ nombreArchivo: string; pdf: Buffer }, "NOT_FOUND">> {
  const leido = await leerDeLaUnidad(deps, input.unitId);
  if (!leido.ok) return leido;
  const d = leido.value;

  const pdf = renderTextPdf([
    "PropNexus - Proof dossier",
    "",
    `Project:      ${d.projectName}`,
    `Unit:         ${d.unitReference}`,
    `Compiled at:  ${d.compiledAt.toISOString()}`,
    `Status:       ${d.status}`,
    `Master hash:  ${d.masterHash}`,
    `Notary TXID:  ${d.signatureTxid ?? "(pending)"}`,
    `Completeness: ${d.completeness}% of artifacts have an on-chain reference`,
    "",
    "This document asserts only that these hashes were registered at these times,",
    "and, where a signature TXID is present, that a notary attested to reviewing them.",
    "It certifies nothing about the construction itself.",
    "",
    "Artifacts",
    "---------",
    ...d.artifacts.flatMap((a) => [
      `[${a.kind}] ${a.label}`,
      `  sha256: ${a.sha256 ?? "(none)"}`,
      `  txid:   ${a.txid ?? "(pending)"}`
    ])
  ]);

  // Exportar no cambia el dossier, pero queda en el audit log quién se llevó qué hash.
  await audit(deps.db, {
    actorUserId: input.actorId,
    action: "EXPORT_DOSSIER",
    entityType: "Dossier",
    entityId: d.id,
    metadata: { masterHash: d.masterHash }
  }).execute();

  return ok({ nombreArchivo: `dossier-${d.unitReference.replace(/[^\w.-]/g, "_")}.pdf`, pdf });
}
