import type { ReservationToEscrowTelemetry } from "@plataforma/shared";
import { Router } from "express";
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
 */
router.get(
  "/telemetry/reservation-to-escrow",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (_req, res) => {
    const eventos = await db
      .selectFrom("OnChainEvent")
      .select(["createdAt", "updatedAt"])
      .where("eventType", "=", "INVITATION_ACCEPTED")
      .where("status", "=", "Confirmed")
      .execute();

    const minutos = eventos
      .map((e) => (e.updatedAt.getTime() - e.createdAt.getTime()) / 60_000)
      .sort((a, b) => a - b);

    const body: ReservationToEscrowTelemetry = {
      sampleSize: minutos.length,
      medianMinutes: mediana(minutos),
      maxMinutes: minutos.length > 0 ? minutos[minutos.length - 1] : null
    };

    return res.json(body);
  }
);

export default router;
