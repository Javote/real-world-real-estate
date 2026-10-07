import type { OnChainEventRow } from "../db/types.js";

/**
 * Reclamar antes de anclar. El reclamo es **una sola escritura condicional** (un
 * `UPDATE … WHERE status = <el previo>`, o un INSERT que no encuentra otro vivo), o un `enLote` si lleva
 * su audit: atómica sin transacción interactiva, que con reclamos simultáneos sobre libSQL da
 * `SQLITE_BUSY` (medido, `SPEC-613` §A1 medido). Devuelve `undefined` si otro ya lo ganó.
 * Solo quien lo gana ancla, después del reclamo y sin esperar el bloque. Quien pierde recibe `null` y
 * decide qué responder (lo que ganó el otro, o un 409).
 */
export async function anclarConReclamo<R>(paso: {
  reclamar: () => Promise<R | undefined>;
  anclar: (reclamo: R) => Promise<OnChainEventRow>;
}): Promise<{ reclamo: R; evento: OnChainEventRow } | null> {
  const reclamo = await paso.reclamar();
  if (reclamo === undefined) return null;
  return { reclamo, evento: await paso.anclar(reclamo) };
}
