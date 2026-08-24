import { createHash } from "node:crypto";
import { createId } from "../db/id";
import type { OnChainEventRow, OnChainEventType } from "../db/types";
import { anchorPort } from "../lib/anchor";
import { db } from "../lib/db";

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

export async function anchorCommitmentEvent(input: {
  projectId: string;
  eventType: OnChainEventType;
  commitment: string;
  /** Ref opaca al registro off-chain. Nunca un nombre ni un email (regla 2). */
  reference: string;
  stageId?: string | null;
  evidenceId?: string | null;
}): Promise<OnChainEventRow> {
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

  const evento = await db
    .insertInto("OnChainEvent")
    .values({
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
      outputRef: null,
      blockTimestamp: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  try {
    const recibo = await anchorPort.anchorCommitment({
      sha256: input.commitment,
      reference: input.reference
    });

    return await db
      .updateTable("OnChainEvent")
      .set({ txid: recibo.txid, status: recibo.status, updatedAt: new Date() })
      .where("id", "=", evento.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch (error) {
    console.error("[anchor] el anclaje del commitment falló", { eventId: evento.id, error });
    return await db
      .updateTable("OnChainEvent")
      .set({ status: "Failed", updatedAt: new Date() })
      .where("id", "=", evento.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
