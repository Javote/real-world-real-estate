import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { db } from "../lib/db";
import { authenticate, projectScope, requireProjectAccess, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

// **El ciclo comercial del developer**, bajo `/api/v1/developer` (M2-D5 filas
// 39, 40-41, 44, 44b).
//
// Unidad → invitación → contrato → liberación es UNA secuencia, y por eso vive
// junta: cada paso produce el estado que el siguiente consume. Separarla por
// entidad —una ruta de unidades, otra de invitaciones, otra de contratos—
// esconde que el orden importa.
//
// Segundo router sobre el mismo prefijo que `developer.routes.ts`, igual que
// `capital.routes.ts`: los paths son disjuntos y ninguno tiene catch-all, así
// que no se pisan (SPEC-015 §4 y §6).
//
// **Nada de esto mueve valor** (D-021): "liberar" significa anclar el evento de
// liberación, no ejecutar un pago.

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "developer"));

/** Fila 44b — las unidades de un proyecto, del lado del developer. */
router.get(
  "/projects/:id/units",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const unidades = await db
      .selectFrom("Unit")
      .selectAll()
      .where("projectId", "=", req.params.id)
      .orderBy("unitReference", "asc")
      .execute();

    return res.json(unidades);
  }
);

router.post(
  "/projects/:id/units",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.strictObject({
      unitReference: z.string().min(1).max(20),
      floor: z.number().int().optional(),
      sizeM2: z.number().int().positive().optional(),
      // Entero en unidades mínimas: nunca un decimal para dinero (regla 1).
      priceMinorUnits: z.number().int().nonnegative().optional(),
      currency: z.string().length(3).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const ahora = new Date();
    const unidad = await db
      .insertInto("Unit")
      .values({
        id: createId(),
        projectId: req.params.id,
        unitReference: parsed.data.unitReference,
        status: "available",
        floor: parsed.data.floor ?? null,
        sizeM2: parsed.data.sizeM2 ?? null,
        priceMinorUnits: parsed.data.priceMinorUnits ?? null,
        currency: parsed.data.currency ?? null,
        investorId: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_UNIT",
      entityType: "Unit",
      entityId: unidad.id
    });

    return res.status(201).json(unidad);
  }
);

router.patch(
  "/units/:id",
  requireRole("admin", "developer"),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.strictObject({
      status: z.enum(["available", "reserved", "sold", "delivered"]).optional(),
      floor: z.number().int().optional(),
      sizeM2: z.number().int().positive().optional(),
      priceMinorUnits: z.number().int().nonnegative().optional(),
      currency: z.string().length(3).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const unidad = await db
      .selectFrom("Unit")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!unidad) return res.status(404).json({ message: "Unit not found" });

    // Segunda capa: la unidad no trae `projectId` en el path, así que la
    // membresía se verifica con el proyecto de la unidad (regla 5).
    const permitido = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", unidad.projectId)
      .where((eb) => projectScope(eb, req.user!.role, req.user!.id, ["developer"]))
      .executeTakeFirst();

    if (!permitido) return res.status(403).json({ message: "Forbidden" });

    const actualizada = await db
      .updateTable("Unit")
      .set({ ...parsed.data, updatedAt: new Date() })
      .where("id", "=", unidad.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Regla 7: editar una unidad es una mutación relevante — cambia el precio,
    // la superficie o el estado comercial de algo que después se invita y se
    // contrata. El alta ya lo escribía; la edición se había quedado sin él.
    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_UNIT",
      entityType: "Unit",
      entityId: unidad.id
    });

    return res.json(actualizada);
  }
);

/** Fila 44 — el inventario cross-proyecto del developer. */
router.get("/units", requireRole("admin", "developer"), async (req, res) => {
  const proyectos = await db
    .selectFrom("Project")
    .select("id")
    .where((eb) => projectScope(eb, req.user!.role, req.user!.id, ["developer"]))
    .execute();

  const ids = proyectos.map((p) => p.id);
  if (ids.length === 0) return res.json([]);

  const unidades = await db
    .selectFrom("Unit")
    .innerJoin("Project", "Project.id", "Unit.projectId")
    .select([
      "Unit.id as id",
      "Unit.unitReference as unitReference",
      "Unit.status as status",
      "Unit.priceMinorUnits as priceMinorUnits",
      "Unit.currency as currency",
      "Unit.investorId as investorId",
      "Project.id as projectId",
      "Project.name as projectName"
    ])
    .where("Unit.projectId", "in", ids)
    .execute();

  return res.json(unidades);
});

/** Fila 39 — el developer emite la invitación. */
router.post(
  "/projects/:id/invitations",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.strictObject({
      unitId: z.string().min(1),
      investorEmail: z.string().email(),
      amountMinorUnits: z.number().int().positive(),
      currency: z.string().length(3)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const unidad = await db
      .selectFrom("Unit")
      .selectAll()
      .where("id", "=", parsed.data.unitId)
      .where("projectId", "=", req.params.id)
      .executeTakeFirst();

    if (!unidad) return res.status(400).json({ message: "Unit does not belong to project" });

    const ahora = new Date();
    const invitacion = await db
      .insertInto("Invitation")
      .values({
        id: createId(),
        projectId: req.params.id,
        unitId: unidad.id,
        investorEmail: parsed.data.investorEmail,
        amountMinorUnits: parsed.data.amountMinorUnits,
        currency: parsed.data.currency,
        status: "pending",
        createdById: req.user!.id,
        createdAt: ahora,
        respondedAt: null
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // La unidad queda reservada mientras la invitación esté pendiente.
    await db
      .updateTable("Unit")
      .set({ status: "reserved", updatedAt: ahora })
      .where("id", "=", unidad.id)
      .execute();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_INVITATION",
      entityType: "Invitation",
      entityId: invitacion.id
    });

    return res.status(201).json(invitacion);
  }
);

/**
 * Fila 40-41 — los contratos de un proyecto, del lado del developer.
 *
 * **El contrato como REGISTRO, no como flujo de pagos** (D-070): lo que sale de
 * acá es quién acordó qué sobre qué unidad, en qué estado quedó la unidad y con
 * qué anclaje se registró el acuerdo. No hay etapas liberadas ni montos por
 * etapa, porque la plataforma no administra fondos.
 *
 * `unitStatus` está porque D-070 lo nombra explícitamente como lo que esta
 * superficie SÍ puede mostrar; el anclaje, porque es la única de las cuatro
 * afirmaciones de D-026 que aplica a un contrato: *se registró en este momento*.
 *
 * El anclaje se alcanza por la invitación y no por el contrato: quien ancla es
 * `POST /investor/invitations/:id/accept`, y el `referenceId` del evento es la
 * invitación. Por eso el join pasa por ahí — el contrato no guarda la ref.
 */
router.get(
  "/projects/:id/contracts",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const contratos = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .innerJoin("User", "User.id", "Contract.investorId")
      .leftJoin("Invitation", (join) =>
        join
          .onRef("Invitation.unitId", "=", "Contract.unitId")
          .on("Invitation.status", "=", "accepted")
      )
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.referenceId", "=", "Invitation.id")
          .on("OnChainEvent.eventType", "=", "INVITATION_ACCEPTED")
      )
      .select([
        "Contract.id as id",
        "Contract.totalMinorUnits as totalMinorUnits",
        "Contract.currency as currency",
        "Contract.signedAt as signedAt",
        "Unit.id as unitId",
        "Unit.unitReference as unitReference",
        "Unit.status as unitStatus",
        "User.fullName as investorName",
        "OnChainEvent.txid as txid",
        "OnChainEvent.commitment as commitment"
      ])
      .where("Unit.projectId", "=", req.params.id)
      .execute();

    return res.json(contratos);
  }
);

/** Fila 40-41 — liberar una etapa. **Ancla** (M3-SC-03). */
router.post(
  "/contracts/:id/releases/:stageNum",
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

export default router;
