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

/** Fila 40-41 — los contratos de un proyecto, del lado del developer. */
router.get(
  "/developer/projects/:id/contracts",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const contratos = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .innerJoin("User", "User.id", "Contract.investorId")
      .select([
        "Contract.id as id",
        "Contract.totalMinorUnits as totalMinorUnits",
        "Contract.currency as currency",
        "Contract.signedAt as signedAt",
        "Unit.id as unitId",
        "Unit.unitReference as unitReference",
        "User.fullName as investorName"
      ])
      .where("Unit.projectId", "=", req.params.id)
      .execute();

    return res.json(contratos);
  }
);

/** Fila 40-41 — liberar una etapa. **Ancla** (M3-SC-03). */
router.post(
  "/developer/contracts/:id/releases/:stageNum",
  requireRole("admin", "developer"),
  async (req: Request<{ id: string; stageNum: string }>, res) => {
    const schema = z.strictObject({ amountMinorUnits: z.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const stageNumber = Number.parseInt(req.params.stageNum, 10);
    if (!Number.isInteger(stageNumber) || stageNumber < 1) {
      return res.status(400).json({ message: "stageNum must be a positive integer" });
    }

    const contrato = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select([
        "Contract.id as id",
        "Contract.unitId as unitId",
        "Contract.currency as currency",
        "Unit.projectId as projectId"
      ])
      .where("Contract.id", "=", req.params.id)
      .executeTakeFirst();

    if (!contrato) return res.status(404).json({ message: "Contract not found" });

    const permitido = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", contrato.projectId)
      .where((eb) => projectScope(eb, req.user!.role, req.user!.id, ["developer"]))
      .executeTakeFirst();

    if (!permitido) return res.status(403).json({ message: "Forbidden" });

    // **La liberación exige que la etapa esté certificada.** El entregable lo
    // dice: "the developer initiates [the release] after the certifier has
    // issued the stage's certificate". Liberar antes sería afirmar un avance
    // que nadie verificó.
    const stage = await db
      .selectFrom("Stage")
      .select(["id", "state"])
      .where("projectId", "=", contrato.projectId)
      .where("sequenceOrder", "=", stageNumber)
      .executeTakeFirst();

    if (!stage) return res.status(404).json({ message: "Stage not found" });
    if (stage.state !== "Completed") {
      return res.status(409).json({
        message: "Stage is not certified yet",
        code: "STAGE_NOT_CERTIFIED",
        state: stage.state
      });
    }

    // Idempotencia (regla 8): el índice único (contrato, etapa) impide liberar
    // dos veces la misma.
    const yaLiberada = await db
      .selectFrom("PaymentRelease")
      .selectAll()
      .where("contractId", "=", contrato.id)
      .where("stageNumber", "=", stageNumber)
      .executeTakeFirst();

    if (yaLiberada) return res.status(200).json(yaLiberada);

    const ahora = new Date();
    const release = await db
      .insertInto("PaymentRelease")
      .values({
        id: createId(),
        contractId: contrato.id,
        stageNumber,
        amountMinorUnits: parsed.data.amountMinorUnits,
        releasedById: req.user!.id,
        releasedAt: ahora
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const anchor = await anchorCommitmentEvent({
      projectId: contrato.projectId,
      eventType: "PAYMENT_RELEASE",
      commitment: commitmentOf({
        contractId: contrato.id,
        stageNumber,
        amountMinorUnits: parsed.data.amountMinorUnits,
        releasedAt: ahora.toISOString()
      }),
      reference: release.id,
      stageId: stage.id
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "RELEASE_PAYMENT",
      entityType: "PaymentRelease",
      entityId: release.id,
      metadata: { stageNumber, txid: anchor.txid }
    });

    return res.status(201).json({ ...release, anchor });
  }
);

/** Fila 23-24 — el contrato de la unidad del investor. */
router.get(
  "/investor/contracts/:unitId",
  requireRole("admin", "buyer"),
  async (req: Request<{ unitId: string }>, res) => {
    const contrato = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select([
        "Contract.id as id",
        "Contract.totalMinorUnits as totalMinorUnits",
        "Contract.currency as currency",
        "Contract.signedAt as signedAt",
        "Contract.investorId as investorId",
        "Unit.unitReference as unitReference"
      ])
      .where("Contract.unitId", "=", req.params.unitId)
      .executeTakeFirst();

    if (!contrato) return res.status(404).json({ message: "Contract not found" });
    if (req.user!.role !== "admin" && contrato.investorId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(contrato);
  }
);

/** Fila 23-24 — las liberaciones del contrato, cada una con su TXID (P10). */
router.get("/contracts/:contractId/releases", async (req: Request<{ contractId: string }>, res) => {
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
