import { reservationToEscrowTelemetrySchema } from "@plataforma/shared";
import { Router } from "express";
import { reconciliarAnclajes } from "../domain/reconcile";
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

  return res.json(logs);
});

function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const mitad = Math.floor(valores.length / 2);
  return valores.length % 2 === 0 ? (valores[mitad - 1] + valores[mitad]) / 2 : valores[mitad];
}

/**
 * Fila 9 del SOM de M3 — "mediana reserva → escrow < 12 min" (D-021). La
 * reserva es `POST /investor/invitations/:id/accept`; el evento nace
 * `Pending` en esa misma request y `reconciliarAnclajes` lo pasa a
 * `Confirmed` cuando ve el TXID en la cadena — no hay poll en background
 * (a propósito, ver `specs/SECURITY-REVIEW-2026-09.md`/`CLAUDE.md`), así que
 * la mediana mide lo que tardó el TXID en confirmar **más** lo que tardó
 * alguien en volver a leer algo de ese proyecto y disparar la reconciliación.
 *
 * Por eso este endpoint reconcilia antes de leer: sin esto, un
 * `INVITATION_ACCEPTED` que ya confirmó en la cadena real podía seguir
 * `Pending` en la base —si nadie más había leído nada de ese proyecto
 * todavía— y quedar afuera de la muestra en silencio, no como dato
 * incorrecto sino como muestra faltante.
 */
router.get(
  "/telemetry/reservation-to-escrow",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (_req, res) => {
    await reconciliarAnclajes();

    const eventos = await db
      .selectFrom("OnChainEvent")
      .select(["createdAt", "updatedAt"])
      .where("eventType", "=", "INVITATION_ACCEPTED")
      .where("status", "=", "Confirmed")
      .execute();

    const minutos = eventos
      .map((e) => (e.updatedAt.getTime() - e.createdAt.getTime()) / 60_000)
      .sort((a, b) => a - b);

    const body = reservationToEscrowTelemetrySchema.parse({
      sampleSize: minutos.length,
      medianMinutes: mediana(minutos),
      maxMinutes: minutos.length > 0 ? minutos[minutos.length - 1] : null
    });

    return res.json(body);
  }
);

export default router;
