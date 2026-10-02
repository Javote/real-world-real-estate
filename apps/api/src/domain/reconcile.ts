import type { LiveThread } from "@plataforma/cardano";
import { refToHex } from "@plataforma/shared";
import { anchorPort } from "../lib/anchor";
import { db } from "../lib/db";
import { sql } from "../lib/kysely";

export interface ResultadoReconciliacion {
  revisados: number;
  confirmados: number;
}

export interface AlcanceReconciliacion {
  projectId?: string;
  projectIds?: string[];
  stageId?: string;
  evidenceId?: string;
  referenceId?: string;
}

const TOPE_POR_LECTURA = 5;

export async function reconciliarAnclajes(limite = 50): Promise<ResultadoReconciliacion> {
  return reconciliar({}, limite);
}

export async function reconciliarParaLectura(alcance: AlcanceReconciliacion): Promise<void> {
  try {
    await reconciliar(alcance, TOPE_POR_LECTURA);
  } catch (error) {
    console.error("[reconcile] la reconciliación por lectura falló", { alcance, error });
  }
}

async function reconciliar(
  alcance: AlcanceReconciliacion,
  limite: number
): Promise<ResultadoReconciliacion> {
  if (anchorPort().mode === "disabled") return { revisados: 0, confirmados: 0 };

  let query = db
    .selectFrom("OnChainEvent")
    .select(["id", "txid"])
    .where("status", "=", "Pending")
    .where("txid", "is not", null);

  if (alcance.projectId) query = query.where("projectId", "=", alcance.projectId);
  if (alcance.projectIds) query = query.where("projectId", "in", alcance.projectIds);
  if (alcance.stageId) query = query.where("stageId", "=", alcance.stageId);
  if (alcance.evidenceId) query = query.where("evidenceId", "=", alcance.evidenceId);
  if (alcance.referenceId) query = query.where("referenceId", "=", alcance.referenceId);

  const pendientes = await query.orderBy("createdAt", "asc").limit(limite).execute();

  let confirmados = 0;

  // En serie y no con Promise.all: el proveedor tiene rate limit y un TXID que falla no corta la tanda.
  for (const evento of pendientes) {
    /* v8 ignore if -- @preserve: la query de arriba ya filtra `txid is not null` */
    if (!evento.txid) continue;

    let blockTimestamp: number | null = null;
    try {
      blockTimestamp = await anchorPort().confirmedAt(evento.txid);
    } catch {
      continue;
    }

    if (blockTimestamp === null) continue;

    await db
      .updateTable("OnChainEvent")
      .set({
        status: "Confirmed",
        blockTimestamp: new Date(blockTimestamp),
        updatedAt: new Date()
      })
      .where("id", "=", evento.id)
      .where("status", "=", "Pending")
      .execute();

    confirmados++;
  }

  return { revisados: pendientes.length, confirmados };
}

export interface HiloSospechoso {
  eventId: string;
  projectId: string;
  stageId: string | null;
  eventIndex: number;
  fromState: string | null;
  toState: string | null;
  status: string;
  createdAt: Date;
}

const TOPE_SOSPECHOSOS = 20;

export async function hilosSospechosos(limite = TOPE_SOSPECHOSOS): Promise<HiloSospechoso[]> {
  return db
    .selectFrom("OnChainEvent")
    .select([
      "id as eventId",
      "projectId",
      "stageId",
      "eventIndex",
      "fromState",
      "toState",
      "status",
      "createdAt"
    ])
    .where("eventType", "=", "STAGE_TRANSITION")
    .where("txid", "is", null)
    .where("stageId", "is not", null)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("OnChainEvent as siguiente")
          .select(sql.lit(1).as("one"))
          .whereRef("siguiente.stageId", "=", "OnChainEvent.stageId")
          .whereRef("siguiente.eventIndex", ">", "OnChainEvent.eventIndex")
      )
    )
    .orderBy("createdAt", "asc")
    .limit(limite)
    .execute();
}

export interface HiloReparado {
  eventId: string;
  txid: string;
  outputRef: string;
}

export async function repararHilosSospechosos(limite = TOPE_SOSPECHOSOS): Promise<HiloReparado[]> {
  if (anchorPort().mode === "disabled") return [];

  const sospechosos = await hilosSospechosos(limite);
  const reparados: HiloReparado[] = [];

  for (const sospechoso of sospechosos) {
    /* v8 ignore if -- @preserve: `hilosSospechosos()` ya filtra `eventType = "STAGE_TRANSITION"` (siempre trae `toState`) y `stageId is not null` */
    if (!sospechoso.stageId || !sospechoso.toState) continue;

    let vivo: LiveThread | null;
    try {
      vivo = await anchorPort().findLiveThread(refToHex(sospechoso.stageId));
    } catch (error) {
      console.error("[reconcile] findLiveThread falló para un sospechoso", {
        eventId: sospechoso.eventId,
        error
      });
      continue;
    }

    if (!vivo || vivo.datum.state !== sospechoso.toState) continue;

    const [txid] = vivo.outputRef.split("#");
    /* v8 ignore if -- @preserve: el adaptador arma `outputRef` como `${txHash}#${índice}`: la parte antes de `#` nunca es vacía */
    if (!txid) continue;

    const escrito = await db
      .updateTable("OnChainEvent")
      .set({
        txid,
        outputRef: vivo.outputRef,
        /* v8 ignore next -- @preserve: `disabled` ya salió en el `if` de arriba, y los adaptadores `simulated`/`real` siempre traen `network` */
        network: anchorPort().network ?? "Preprod",
        status: "Pending",
        updatedAt: new Date()
      })
      .where("id", "=", sospechoso.eventId)
      .where("txid", "is", null)
      .executeTakeFirst();

    if (Number(escrito.numUpdatedRows) > 0) {
      reparados.push({ eventId: sospechoso.eventId, txid, outputRef: vivo.outputRef });
    }
  }

  return reparados;
}
