import { auditLogRowSchema, reservationToEscrowTelemetrySchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { reconciliarAnclajes } from "../domain/reconcile";
import { en } from "../lib/arrays";
import { db } from "../lib/db";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.use(authenticate);

router.get("/", authorize({ roles: ["admin"], acceso: "soloRol" }), async (_req, res) => {
  const logs = await db
    .selectFrom("AuditLog")
    .selectAll()
    .orderBy("createdAt", "desc")
    .limit(200)
    .execute();

  return res.json(z.array(auditLogRowSchema).parse(logs));
});

function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const mitad = Math.floor(valores.length / 2);
  return valores.length % 2 === 0
    ? (en(valores, mitad - 1) + en(valores, mitad)) / 2
    : en(valores, mitad);
}

/**
 * Fila 9 del SOM de M3 — "mediana reserva → escrow < 12 min" (D-021). La
 * reserva es `POST /investor/invitations/:id/accept`; el evento nace
 * `Pending` en esa misma request y `reconciliarAnclajes` lo pasa a
 * `Confirmed` cuando ve el TXID en la cadena — no hay poll en background
 * (a propósito, ver `specs/SECURITY-REVIEW-2026-09.md`/`CLAUDE.md`).
 *
 * Por eso este endpoint reconcilia antes de leer: sin esto, un
 * `INVITATION_ACCEPTED` que ya confirmó en la cadena real podía seguir
 * `Pending` en la base —si nadie más había leído nada de ese proyecto
 * todavía— y quedar afuera de la muestra en silencio, no como dato
 * incorrecto sino como muestra faltante.
 *
 * SPEC-214: la medición es `blockTimestamp - createdAt` — el instante real
 * en que la transacción entró en un bloque, que es lo que el SOM pregunta
 * ("mediana reserva → escrow"). Antes era `updatedAt - createdAt`, que suma
 * el tiempo de confirmación en cadena MÁS lo que tardó alguien en volver a
 * leer algo de ese proyecto y disparar la reconciliación (D-077) — el hueco
 * que el cierre del criterio 9 (2026-09-11) encontró en la muestra real.
 * `updatedAt` sigue siendo el respaldo declarado para una fila `Confirmed`
 * de antes de que `blockTimestamp` se poblara consistentemente;
 * `withBlockTimestampCount` dice cuántas de la muestra son la medición real
 * y no el respaldo, para que `sampleSize` siga siendo interpretable.
 *
 * Un `blockTimestamp` anterior a `createdAt` es imposible en teoría (la
 * cadena no puede confirmar algo antes de que la reserva se declarara); si
 * apareciera, se descarta y se loguea — nunca se publica una duración
 * negativa.
 */
router.get(
  "/telemetry/reservation-to-escrow",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (_req, res) => {
    await reconciliarAnclajes();

    const eventos = await db
      .selectFrom("OnChainEvent")
      .select(["createdAt", "updatedAt", "blockTimestamp"])
      .where("eventType", "=", "INVITATION_ACCEPTED")
      .where("status", "=", "Confirmed")
      .execute();

    let withBlockTimestampCount = 0;
    const minutos: number[] = [];

    for (const evento of eventos) {
      const fin = evento.blockTimestamp ?? evento.updatedAt;
      const ms = fin.getTime() - evento.createdAt.getTime();

      if (ms < 0) {
        console.warn("[telemetry] reservation-to-escrow: duración negativa descartada", {
          createdAt: evento.createdAt,
          fin
        });
        continue;
      }

      if (evento.blockTimestamp) withBlockTimestampCount++;
      minutos.push(ms / 60_000);
    }

    minutos.sort((a, b) => a - b);

    const body = reservationToEscrowTelemetrySchema.parse({
      sampleSize: minutos.length,
      medianMinutes: mediana(minutos),
      maxMinutes: minutos.length > 0 ? minutos[minutos.length - 1] : null,
      withBlockTimestampCount
    });

    return res.json(body);
  }
);

export default router;
