import { createHash } from "node:crypto";
import type { MetadataAnchorReceipt } from "@plataforma/cardano";
import { createId } from "../db/id";
import type { Database, OnChainEventRow, OnChainEventType } from "../db/types";
import { Sentry } from "../instrumentation";
import { anchorPort } from "../lib/anchor";
import { db } from "../lib/db";
import { type ExpressionBuilder, sql } from "../lib/kysely";

// Anclaje por metadata de cualquier commitment que **no** mueva el hilo de un
// stage: aceptación de invitación (M3-SC-01), liberación (M3-SC-03), firma del
// notario (M3-SC-04), documento suelto (M3-SC-06).
//
// **La misma asimetría de siempre** (D-059): el registro se escribe primero y
// la prueba queda `Pending`; si el anclaje falla, el evento queda `Failed` y el
// hecho declarado sigue en pie. Nunca al revés.

/**
 * El commitment de un evento: SHA-256 de su contenido canónico.
 *
 * **Nunca se ancla el contenido, solo su huella** (regla 2). Un release lleva
 * montos y una firma lleva quién firmó: nada de eso puede terminar en la
 * cadena.
 */
export function commitmentOf(payload: Record<string, string | number>): string {
  const canonico = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(canonico).digest("hex");
}

type AnclajeInput = {
  projectId: string;
  eventType: OnChainEventType;
  commitment: string;
  /** Ref opaca al registro off-chain. Nunca un nombre ni un email (regla 2). */
  reference: string;
  stageId?: string | null;
  evidenceId?: string | null;
};

const RECLAMO_VENCIDO_MS = 10 * 60_000;

async function eventoPendiente(input: AnclajeInput) {
  const ahora = new Date();

  // **Este índice es compartido con los eventos del hilo, a propósito.** Es la
  // posición en el log de eventos del stage, no en su hilo: un
  // `EVIDENCE_ANCHOR` se intercala entre dos `STAGE_TRANSITION` y les corre la
  // numeración. Lo que distingue al hilo no es el índice sino `outputRef`, que
  // acá queda `null` siempre — ver `recordOnChainEvent` en
  // `stage-transition.ts`.
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
    // La ref queda persistida, no solo enviada al port: es lo único que
    // permite volver del registro off-chain a su TXID sin recomputar un
    // commitment que incluye timestamps.
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

/**
 * Ancla el hash de una evidencia **a lo sumo una vez**: el `INSERT` del evento
 * es condicional, y solo lo gana quien no encuentra otro anclaje vivo de esa
 * evidencia (con TXID, o `Pending` y reciente). Quien pierde recibe ese evento
 * y no envía nada. Un `Pending` sin TXID más viejo que `RECLAMO_VENCIDO_MS` es
 * un envío que murió a mitad de camino y no bloquea el reintento.
 */
export async function anclarEvidenciaUnaVez(
  input: AnclajeInput & { evidenceId: string }
): Promise<{ evento: OnChainEventRow; nuevo: boolean }> {
  const valores = await eventoPendiente(input);
  const vivo = (eb: ExpressionBuilder<Database, "OnChainEvent">) =>
    eb.and([
      eb("OnChainEvent.evidenceId", "=", input.evidenceId),
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
    recibo = await anchorPort().anchorCommitment({
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

  // El recibo se guarda apenas existe, no cuando termina de confirmar — mismo
  // fix que `anchorEvent` en `stage-transition.ts` (2026-09-10, ver
  // `specs/REPORTE-2026-09-10-prueba-de-volumen.md` §Cómo hacerlo más
  // robusto): si el proceso muere entre acá y el `confirmedAt()` de abajo, el
  // TXID real ya quedó escrito.
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

  // Confirmar es best-effort: si falla, el evento queda `Pending` con TXID
  // real — nunca `Failed`, el anclaje ya ocurrió. D-077 lo reconcilia después.
  //
  // El recibo llega `Pending` siempre (D-087, mismo contrato que el hilo en
  // `anchorEvent`): `confirmedAt` es el único que puede decir `Confirmed`.
  // No hay `verify()` acá porque un anclaje por metadata no tiene datum ni
  // outputRef — `confirmedAt` es la pregunta que sí le cabe (ver
  // `SimulatedAnchorAdapter.confirmedAt`).
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
