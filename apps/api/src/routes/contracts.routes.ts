import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { db } from "../lib/db";
import { authenticate, projectScope, requireProjectAccess, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

// Contratos y liberaciones (M2-D5 filas 23-24, 40-41) — **M3-SC-03**.
//
// **Cada liberación es su propio evento on-chain** (M2-D4 P10): el contrato es
// una entidad lógica, el artefacto anclado es cada release. Y "release"
// significa **anclar el evento de liberación**, no ejecutar un pago (D-021): la
// plataforma no mueve un centavo, registra que se liberó.

const router = Router();

router.use(authenticate);

/** Fila 23-24 — las liberaciones del contrato, cada una con su TXID (P10). */
router.get("/:contractId/releases", async (req: Request<{ contractId: string }>, res) => {
  const contrato = await db
    .selectFrom("Contract")
    .innerJoin("Unit", "Unit.id", "Contract.unitId")
    .select([
      "Contract.id as id",
      "Contract.investorId as investorId",
      "Unit.projectId as projectId"
    ])
    .where("Contract.id", "=", req.params.contractId)
    .executeTakeFirst();

  if (!contrato) return res.status(404).json({ message: "Contract not found" });

  // Lo ve el investor dueño, o quien tenga membresía en el proyecto.
  const esDueño = contrato.investorId === req.user!.id;
  const esMiembro = await db
    .selectFrom("Project")
    .select("id")
    .where("id", "=", contrato.projectId)
    .where((eb) =>
      projectScope(eb, req.user!.role, req.user!.id, ["developer", "buyer", "verifier"])
    )
    .executeTakeFirst();

  if (!esDueño && !esMiembro) return res.status(403).json({ message: "Forbidden" });

  // Cada release con su TXID (patrón P10). El vínculo es `referenceId`, que
  // guarda el id del propio release: buscarlos por su commitment no sirve
  // —el commitment incluye el timestamp de liberación— y sin la ref no había
  // forma de volver del registro off-chain a su transacción.
  const releases = await db
    .selectFrom("PaymentRelease")
    .leftJoin("OnChainEvent", (join) =>
      join
        .onRef("OnChainEvent.referenceId", "=", "PaymentRelease.id")
        .on("OnChainEvent.eventType", "=", "PAYMENT_RELEASE")
    )
    .select([
      "PaymentRelease.id as id",
      "PaymentRelease.stageNumber as stageNumber",
      "PaymentRelease.amountMinorUnits as amountMinorUnits",
      "PaymentRelease.releasedAt as releasedAt",
      "OnChainEvent.commitment as commitment",
      "OnChainEvent.txid as txid",
      "OnChainEvent.status as anchorStatus"
    ])
    .where("PaymentRelease.contractId", "=", contrato.id)
    .orderBy("PaymentRelease.stageNumber", "asc")
    .execute();

  return res.json(releases);
});

export default router;
