import { createHash } from "node:crypto";
import type { MetadataAnchorReceipt } from "@plataforma/cardano";
import { createId } from "../db/id.js";
import type { Database, OnChainEventRow, OnChainEventType } from "../db/types.js";
import { Sentry } from "../instrumentation.js";
import { anchorPort, anchorPortListo } from "../lib/anchor.js";
import { db } from "../lib/db.js";
import { type Expression, type ExpressionBuilder, sql } from "../lib/kysely.js";

export function commitmentOf(payload: Record<string, string | number>): string {
  const canonico = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(canonico).digest("hex");
}

/**
 * El `EVIDENCE_ANCHOR` que cubre una evidencia. Un lote se ancla una vez, con el bundle en
 * `referenceId` y solo su primer archivo en `evidenceId`, y los bundles de un stage son
 * acumulativos: gana el de `loteId` si se pide, después uno con TXID y después el más viejo.
 */
export function anclajeDeLaEvidencia(evidenceId: Expression<string>, loteId?: string) {
  let anclajes = db
    .selectFrom("OnChainEvent as anclaje")
    .select("anclaje.id")
    .where("anclaje.eventType", "=", "EVIDENCE_ANCHOR")
    .where((eb) =>
      eb.or([
        eb("anclaje.evidenceId", "=", evidenceId),
        eb(
          "anclaje.referenceId",
          "in",
          eb
            .selectFrom("EvidenceBundleItem")
            .select("EvidenceBundleItem.bundleId")
            .where("EvidenceBundleItem.evidenceId", "=", evidenceId)
        )
      ])
    );

  if (loteId) anclajes = anclajes.orderBy(sql`anclaje.referenceId = ${loteId}`, "desc");

  return anclajes.orderBy(sql`anclaje.txid is null`).orderBy("anclaje.createdAt", "asc").limit(1);
}

type AnclajeInput = {
  projectId: string;
  eventType: OnChainEventType;
  commitment: string;
  reference: string;
  stageId?: string | null;
  evidenceId?: string | null;
};

const RECLAMO_VENCIDO_MS = 10 * 60_000;

async function eventoPendiente(input: AnclajeInput) {
  const ahora = new Date();

  const previo = input.stageId
    ? await db
        .selectFrom("OnChainEvent")
        .select("eventIndex")
        .where("stageId", "=", input.stageId)
        .orderBy("eventIndex", "desc")
        .limit(1)
        .executeTakeFirst()
    : undefined;

  return {
    id: createId(),
    projectId: input.projectId,
    stageId: input.stageId ?? null,
    evidenceId: input.evidenceId ?? null,
    referenceId: input.reference,
    eventIndex: previo ? previo.eventIndex + 1 : 0,
    eventType: input.eventType,
    fromState: null,
    toState: null,
    commitment: input.commitment,
    status: "Pending",
    txid: null,
    network: null,
    outputRef: null,
    blockTimestamp: null,
    createdAt: ahora,
    updatedAt: ahora
  } as const;
}

export async function anchorCommitmentEvent(input: AnclajeInput): Promise<OnChainEventRow> {
  const evento = await db
    .insertInto("OnChainEvent")
    .values(await eventoPendiente(input))
    .returningAll()
    .executeTakeFirstOrThrow();

  return enviar(evento, input);
}

// INSERT condicional: lo gana quien no encuentra otro anclaje vivo; un Pending sin TXID vencido no bloquea.
export async function anclarEvidenciaUnaVez(
  input: AnclajeInput & { evidenceId: string }
): Promise<{ evento: OnChainEventRow; nuevo: boolean }> {
  const valores = await eventoPendiente(input);
  const vivo = (eb: ExpressionBuilder<Database, "OnChainEvent">) =>
    eb.and([
      eb.or([
        eb("OnChainEvent.evidenceId", "=", input.evidenceId),
        eb(
          "OnChainEvent.referenceId",
          "in",
          eb
            .selectFrom("EvidenceBundleItem")
            .select("EvidenceBundleItem.bundleId")
            .where("EvidenceBundleItem.evidenceId", "=", input.evidenceId)
        )
      ]),
      eb.or([
        eb("OnChainEvent.txid", "is not", null),
        eb.and([
          eb("OnChainEvent.status", "=", "Pending"),
          eb("OnChainEvent.createdAt", ">=", new Date(Date.now() - RECLAMO_VENCIDO_MS))
        ])
      ])
    ]);

  const columnas = Object.keys(valores) as (keyof typeof valores)[];
  const reclamado = await db
    .insertInto("OnChainEvent")
    .columns(columnas)
    .expression(
      db
        .selectNoFrom((eb) => columnas.map((c) => eb.val(valores[c]).as(c)))
        .where((eb) => eb.not(eb.exists(eb.selectFrom("OnChainEvent").select("id").where(vivo))))
    )
    .returningAll()
    .executeTakeFirst();

  if (!reclamado) {
    const existente = await db
      .selectFrom("OnChainEvent")
      .selectAll()
      .where(vivo)
      .orderBy(sql`txid is null`)
      .orderBy("createdAt", "desc")
      .executeTakeFirstOrThrow();
    return { evento: existente, nuevo: false };
  }

  return { evento: await enviar(reclamado, input), nuevo: true };
}

async function enviar(evento: OnChainEventRow, input: AnclajeInput): Promise<OnChainEventRow> {
  let recibo: MetadataAnchorReceipt;
  try {
    recibo = await (await anchorPortListo()).anchorCommitment({
      sha256: input.commitment,
      reference: input.reference
    });
  } catch (error) {
    console.error("[anchor] el anclaje del commitment falló", { eventId: evento.id, error });
    Sentry.captureException(error, {
      tags: { area: "anchor" },
      extra: { eventId: evento.id, eventType: input.eventType }
    });
    return await db
      .updateTable("OnChainEvent")
      .set({ status: "Failed", updatedAt: new Date() })
      .where("id", "=", evento.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  let anclado = await db
    .updateTable("OnChainEvent")
    .set({
      txid: recibo.txid,
      network: anchorPort().network,
      status: recibo.status,
      updatedAt: new Date()
    })
    .where("id", "=", evento.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  try {
    const blockTimestamp = await anchorPort().confirmedAt(recibo.txid);
    if (blockTimestamp !== null) {
      anclado = await db
        .updateTable("OnChainEvent")
        .set({
          status: "Confirmed",
          blockTimestamp: new Date(blockTimestamp),
          updatedAt: new Date()
        })
        .where("id", "=", evento.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }
  } catch (error) {
    console.error("[anchor] la confirmación del commitment falló — el anclaje ya está guardado", {
      eventId: evento.id,
      error
    });
  }

  return anclado;
}
