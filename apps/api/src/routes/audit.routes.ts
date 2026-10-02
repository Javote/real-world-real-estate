import { auditLogRowSchema, reservationToEscrowTelemetrySchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { reconciliarAnclajes } from "../domain/reconcile.js";
import { en } from "../lib/arrays.js";
import { db } from "../lib/db.js";
import { delegarAOrpc, OpenAPIHandler, os } from "../lib/orpc.js";
import { authenticate, authorize } from "../middlewares/auth.js";

const PREFIJO_ABSOLUTO = "/api/v1/audit-logs";

const router = Router();

router.use(authenticate);

const auditLogsProcedure = os
  .route({ method: "GET", path: "/" })
  .output(z.array(auditLogRowSchema))
  .handler(async () => {
    const logs = await db
      .selectFrom("AuditLog")
      .selectAll()
      .orderBy("createdAt", "desc")
      .limit(200)
      .execute();

    return z.array(auditLogRowSchema).parse(logs);
  });
const auditLogsHandler = new OpenAPIHandler({ auditLogsProcedure });

router.get(
  "/",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(auditLogsHandler, PREFIJO_ABSOLUTO)
);

function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const mitad = Math.floor(valores.length / 2);
  return valores.length % 2 === 0
    ? (en(valores, mitad - 1) + en(valores, mitad)) / 2
    : en(valores, mitad);
}

const reservationToEscrowProcedure = os
  .route({ method: "GET", path: "/telemetry/reservation-to-escrow" })
  .output(reservationToEscrowTelemetrySchema)
  .handler(async () => {
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

    return reservationToEscrowTelemetrySchema.parse({
      sampleSize: minutos.length,
      medianMinutes: mediana(minutos),
      maxMinutes: minutos.length > 0 ? minutos[minutos.length - 1] : null,
      withBlockTimestampCount
    });
  });
const reservationToEscrowHandler = new OpenAPIHandler({ reservationToEscrowProcedure });

router.get(
  "/telemetry/reservation-to-escrow",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(reservationToEscrowHandler, PREFIJO_ABSOLUTO)
);

export const auditOrpcRouter = {
  auditLogsProcedure,
  reservationToEscrowProcedure
};

export default router;
