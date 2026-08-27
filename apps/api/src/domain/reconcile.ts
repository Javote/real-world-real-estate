import { anchorPort } from "../lib/anchor";
import { db } from "../lib/db";

// Reconciliación: promover a `Confirmed` los anclajes que ya están en la cadena
// (SPEC-013 §C, la parte mínima).
//
// **Por qué existe.** Anclar devuelve `Pending` y es lo correcto: en ese momento
// la transacción está enviada, no confirmada, y la regla 17 prohíbe mostrar una
// señal de prueba que no podamos sustanciar. Pero sin nadie que vuelva a mirar,
// `Pending` era para siempre —la evidencia quedaba anclada de verdad y la UI
// decía "Pendiente" eternamente—.
//
// **No hay `setInterval` acá, y es deliberado** (D-003 · D-040): un timer dentro
// de la API deja de contar cuando Render duerme el servicio a los 15 minutos, y
// el free tier no tiene workers. El disparo es externo — hoy `POST
// /evidence/reconcile`, mañana un cron de GitHub Actions contra ese mismo
// endpoint.

export interface ResultadoReconciliacion {
  revisados: number;
  confirmados: number;
}

/**
 * Revisa los eventos `Pending` que tienen TXID y confirma los que ya entraron
 * en un bloque.
 *
 * Un evento sin `txid` **no se toca**: es un anclaje que falló al enviarse
 * (`Failed`) o que todavía no se envió, y ahí no hay nada que consultar.
 */
export async function reconciliarAnclajes(limite = 50): Promise<ResultadoReconciliacion> {
  const pendientes = await db
    .selectFrom("OnChainEvent")
    .select(["id", "txid"])
    .where("status", "=", "Pending")
    .where("txid", "is not", null)
    .orderBy("createdAt", "asc")
    .limit(limite)
    .execute();

  let confirmados = 0;

  for (const evento of pendientes) {
    if (!evento.txid) continue;

    // Uno por uno y sin `Promise.all`: son llamadas a un proveedor externo con
    // límite de rate, y este trabajo no tiene apuro. Que un TXID falle no puede
    // tumbar la tanda entera.
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
      // Solo si sigue `Pending`: entre la consulta y el update pudo haber pasado
      // otra tanda. Sin esto, dos disparos concurrentes se pisan.
      .where("status", "=", "Pending")
      .execute();

    confirmados++;
  }

  return { revisados: pendientes.length, confirmados };
}
