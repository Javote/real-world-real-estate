import type { LiveThread } from "@plataforma/cardano";
import { refToHex, type StageState } from "@plataforma/shared";
import { anchorPort, anchorPortListo } from "../lib/anchor.js";
import { db } from "../lib/db.js";
import { sql } from "../lib/kysely.js";

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
  if ((await anchorPortListo()).mode === "disabled") return { revisados: 0, confirmados: 0 };

  let query = db
    .selectFrom("OnChainEvent")
    .select(["id", "txid"])
    .where("status", "=", "Pending")
    .where("txid", "is not", null)
    .$narrowType<{ txid: string }>();

  if (alcance.projectId) query = query.where("projectId", "=", alcance.projectId);
  if (alcance.projectIds) query = query.where("projectId", "in", alcance.projectIds);
  if (alcance.stageId) query = query.where("stageId", "=", alcance.stageId);
  if (alcance.evidenceId) query = query.where("evidenceId", "=", alcance.evidenceId);
  if (alcance.referenceId) query = query.where("referenceId", "=", alcance.referenceId);

  const pendientes = await query.orderBy("createdAt", "asc").limit(limite).execute();

  let confirmados = 0;

  // En serie y no con Promise.all: el proveedor tiene rate limit y un TXID que falla no corta la tanda.
  for (const evento of pendientes) {
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
  stageId: string;
  eventIndex: number;
  fromState: string | null;
  toState: string;
  status: string;
  createdAt: Date;
}

const TOPE_SOSPECHOSOS = 20;

export async function hilosSospechosos(limite = TOPE_SOSPECHOSOS): Promise<HiloSospechoso[]> {
  return (
    db
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
      // Filtra `stageId is not null`, y una STAGE_TRANSITION siempre trae `toState`.
      .$narrowType<{ stageId: string; toState: StageState }>()
      .execute()
  );
}

export interface HiloReparado {
  eventId: string;
  txid: string;
  outputRef: string;
}

export async function repararHilosSospechosos(limite = TOPE_SOSPECHOSOS): Promise<HiloReparado[]> {
  if ((await anchorPortListo()).mode === "disabled") return [];

  const sospechosos = await hilosSospechosos(limite);
  const reparados: HiloReparado[] = [];

  for (const sospechoso of sospechosos) {
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

    const txid = vivo.outputRef.replace(/#.*$/, "");

    const escrito = await db
      .updateTable("OnChainEvent")
      .set({
        txid,
        outputRef: vivo.outputRef,
        // `disabled` ya salió arriba, y `simulated` y `real` siempre traen `network`.
        network: anchorPort().network!,
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
