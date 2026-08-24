import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { db } from "../lib/db";
import { authenticate, projectScope, requireProjectAccess, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

// Unidades (M2-D5 filas 14, 15-18, 21, 44, 44b).
//
// D-029: la unidad es **lo comercial** y nace en la subdivisión. Los stages son
// del proyecto y son los mismos para todas las unidades hermanas — por eso el
// avance de una unidad se calcula con los stages de SU PROYECTO, no con stages
// propios. Un desarrollo tiene un solo trámite.

const router = Router();

router.use(authenticate);

/** Avance de obra del proyecto: es el mismo para todas sus unidades (D-029). */
async function avancePorProyecto(projectIds: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (projectIds.length === 0) return mapa;

  const stages = await db
    .selectFrom("Stage")
    .select(["projectId", "state"])
    .where("projectId", "in", projectIds)
    .execute();

  for (const id of projectIds) {
    const suyos = stages.filter((s) => s.projectId === id);
    const completados = suyos.filter((s) => s.state === "Completed").length;
    mapa.set(id, suyos.length ? Math.round((completados / suyos.length) * 100) : 0);
  }
  return mapa;
}

/** Fila 44b — las unidades de un proyecto, del lado del developer. */
router.get(
  "/developer/projects/:id/units",
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
  "/developer/projects/:id/units",
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
  "/developer/units/:id",
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

    return res.json(actualizada);
  }
);

/** Fila 44 — el inventario cross-proyecto del developer. */
router.get("/developer/units", requireRole("admin", "developer"), async (req, res) => {
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

/** Fila 14 — My Units: las del investor autenticado. */
router.get("/investor/units", requireRole("admin", "buyer"), async (req, res) => {
  const unidades = await db
    .selectFrom("Unit")
    .innerJoin("Project", "Project.id", "Unit.projectId")
    .select([
      "Unit.id as id",
      "Unit.unitReference as unitReference",
      "Unit.status as status",
      "Unit.sizeM2 as sizeM2",
      "Unit.priceMinorUnits as priceMinorUnits",
      "Unit.currency as currency",
      "Project.id as projectId",
      "Project.name as projectName",
      "Project.city as city"
    ])
    .where("Unit.investorId", "=", req.user!.id)
    .execute();

  const avance = await avancePorProyecto([...new Set(unidades.map((u) => u.projectId))]);

  return res.json(unidades.map((u) => ({ ...u, progress: avance.get(u.projectId) ?? 0 })));
});

/** Fila 15-18 — el detalle de la unidad, con los stages del proyecto y su anclaje. */
router.get(
  "/investor/units/:id",
  requireRole("admin", "buyer"),
  async (req: Request<{ id: string }>, res) => {
    const unidad = await db
      .selectFrom("Unit")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .select([
        "Unit.id as id",
        "Unit.unitReference as unitReference",
        "Unit.status as status",
        "Unit.sizeM2 as sizeM2",
        "Unit.floor as floor",
        "Unit.priceMinorUnits as priceMinorUnits",
        "Unit.currency as currency",
        "Unit.investorId as investorId",
        "Project.id as projectId",
        "Project.name as projectName",
        "Project.city as city",
        "Project.country as country"
      ])
      .where("Unit.id", "=", req.params.id)
      .executeTakeFirst();

    if (!unidad) return res.status(404).json({ message: "Unit not found" });

    // **Aislamiento cross-rol** (M2-D1 §Cross-role data isolation): el investor
    // ve SU unidad y ninguna otra.
    if (req.user!.role !== "admin" && unidad.investorId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Los stages son del proyecto, con su estado de anclaje: esto alimenta los
    // StageChips del patrón P9.
    const stages = await db
      .selectFrom("Stage")
      .leftJoin("EvidenceBundle", "EvidenceBundle.stageId", "Stage.id")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.stageId", "=", "Stage.id")
          .on("OnChainEvent.eventType", "=", "STAGE_TRANSITION")
          .on("OnChainEvent.toState", "=", "Completed")
      )
      .select([
        "Stage.id as stageId",
        "Stage.name as name",
        "Stage.sequenceOrder as sequenceOrder",
        "Stage.state as state",
        "EvidenceBundle.id as bundleId",
        "OnChainEvent.txid as txid"
      ])
      .where("Stage.projectId", "=", unidad.projectId)
      .orderBy("Stage.sequenceOrder", "asc")
      .execute();

    return res.json({ ...unidad, stages });
  }
);

/** Fila 15-18 — las novedades de la unidad: los eventos de sus stages. */
router.get(
  "/investor/units/:id/news",
  requireRole("admin", "buyer"),
  async (req: Request<{ id: string }>, res) => {
    const unidad = await db
      .selectFrom("Unit")
      .select(["id", "projectId", "investorId"])
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!unidad) return res.status(404).json({ message: "Unit not found" });
    if (req.user!.role !== "admin" && unidad.investorId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const eventos = await db
      .selectFrom("OnChainEvent")
      .leftJoin("Stage", "Stage.id", "OnChainEvent.stageId")
      .select([
        "OnChainEvent.id as id",
        "OnChainEvent.eventType as eventType",
        "OnChainEvent.toState as toState",
        "OnChainEvent.txid as txid",
        "OnChainEvent.status as status",
        "OnChainEvent.createdAt as createdAt",
        "Stage.name as stageName"
      ])
      .where("OnChainEvent.projectId", "=", unidad.projectId)
      .orderBy("OnChainEvent.createdAt", "desc")
      .limit(50)
      .execute();

    return res.json(eventos);
  }
);

/** Fila 21 — el esquema del edificio: las unidades por piso. */
router.get(
  "/projects/:id/building-schematic",
  requireProjectAccess({ param: "id" }, ["developer", "buyer", "verifier"]),
  async (req: Request<{ id: string }>, res) => {
    const unidades = await db
      .selectFrom("Unit")
      .select(["id", "unitReference", "floor", "status"])
      .where("projectId", "=", req.params.id)
      .orderBy("floor", "desc")
      .orderBy("unitReference", "asc")
      .execute();

    // Agrupado por piso, que es como lo dibuja la captura 21. Las unidades sin
    // piso van juntas al final en vez de inventarles uno.
    const pisos = new Map<number | null, typeof unidades>();
    for (const unidad of unidades) {
      const actual = pisos.get(unidad.floor) ?? [];
      actual.push(unidad);
      pisos.set(unidad.floor, actual);
    }

    return res.json([...pisos.entries()].map(([floor, units]) => ({ floor, units })));
  }
);

export default router;
