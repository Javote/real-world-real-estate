import { INITIAL_STAGE_STATE } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { db } from "../lib/db";
import { authenticate, projectScope, requireProjectAccess, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

// Superficie del developer (M2-D5 filas 34b-34c, 35-36, 37, 45, 46-47, 49).
//
// **Son los mismos datos que ya sirven las rutas genéricas, con la forma y el
// path que el backlog pide.** No es duplicación: `/projects` es CRUD nuestro y
// `/developer/projects` es una superficie del entregable, con su scope y su
// forma. El día que el CRUD genérico no le sirva a nadie, se borra.

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "developer"));

function misProyectos(userId: string, role: "admin" | "developer") {
  return db
    .selectFrom("Project")
    .selectAll("Project")
    .where((eb) => projectScope(eb, role, userId, ["developer"]));
}

/** Fila 35-36 — el listado de proyectos del developer, con su avance. */
router.get("/developer/projects", async (req, res) => {
  const proyectos = await misProyectos(req.user!.id, req.user!.role as "admin" | "developer")
    .orderBy("createdAt", "desc")
    .execute();

  const ids = proyectos.map((p) => p.id);
  const stages = ids.length
    ? await db
        .selectFrom("Stage")
        .select(["projectId", "state"])
        .where("projectId", "in", ids)
        .execute()
    : [];

  return res.json(
    proyectos.map((proyecto) => {
      const suyos = stages.filter((s) => s.projectId === proyecto.id);
      const completados = suyos.filter((s) => s.state === "Completed").length;
      return {
        ...proyecto,
        stageCount: suyos.length,
        progress: suyos.length ? Math.round((completados / suyos.length) * 100) : 0
      };
    })
  );
});

/** Fila 37 — el detalle, que en la captura es una grilla de acciones + 3 stats. */
router.get(
  "/developer/projects/:id",
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const proyecto = await db
      .selectFrom("Project")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!proyecto) return res.status(404).json({ message: "Project not found" });

    const stages = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", proyecto.id)
      .orderBy("sequenceOrder", "asc")
      .execute();

    const evidencia = await db
      .selectFrom("Evidence")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .where("projectId", "=", proyecto.id)
      .executeTakeFirst();

    return res.json({
      ...proyecto,
      stages,
      evidenceCount: Number(evidencia?.total ?? 0)
    });
  }
);

/** Fila 34b-34c — crear un desarrollo. */
router.post("/developer/projects", async (req, res) => {
  const schema = z.strictObject({
    name: z.string().min(1),
    slug: z.string().min(1),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    totalUnits: z.number().int().nonnegative().optional(),
    estimatedDelivery: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const ahora = new Date();
  const proyecto = await db
    .insertInto("Project")
    .values({
      id: createId(),
      name: parsed.data.name,
      slug: parsed.data.slug,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      country: parsed.data.country ?? null,
      totalUnits: parsed.data.totalUnits ?? 0,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : null,
      status: "planning",
      createdAt: ahora,
      updatedAt: ahora
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Quien crea el proyecto queda como su developer: sin esto, el creador no
  // pasaría su propia segunda capa de autorización (regla 5).
  await db
    .insertInto("ProjectMember")
    .values({
      id: createId(),
      userId: req.user!.id,
      projectId: proyecto.id,
      membershipRole: "developer",
      createdAt: ahora
    })
    .execute();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "CREATE_PROJECT",
    entityType: "Project",
    entityId: proyecto.id
  });

  return res.status(201).json(proyecto);
});

/** Fila 45 — el avance de obra a través de todos los proyectos. */
router.get("/developer/progress", async (req, res) => {
  const ids = (
    await misProyectos(req.user!.id, req.user!.role as "admin" | "developer").execute()
  ).map((p) => p.id);

  if (ids.length === 0) return res.json([]);

  const stages = await db
    .selectFrom("Stage")
    .innerJoin("Project", "Project.id", "Stage.projectId")
    .select([
      "Stage.id as stageId",
      "Stage.name as stageName",
      "Stage.sequenceOrder as sequenceOrder",
      "Stage.state as state",
      "Project.id as projectId",
      "Project.name as projectName"
    ])
    .where("Stage.projectId", "in", ids)
    .orderBy("Project.name", "asc")
    .orderBy("Stage.sequenceOrder", "asc")
    .execute();

  return res.json(stages);
});

/**
 * Fila 46-47 — la documentación del developer, con su estado de anclaje.
 *
 * "Documento" acá es evidencia: el modelo no distingue todavía entre evidencia
 * de stage y documento suelto de proyecto (M3-SC-06). Cuando lo distinga, esta
 * ruta filtra; hoy devuelve todo con su estado real de prueba.
 */
router.get("/developer/documents", async (req, res) => {
  const schema = z.object({ status: z.enum(["anchored", "pending"]).optional() });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const ids = (
    await misProyectos(req.user!.id, req.user!.role as "admin" | "developer").execute()
  ).map((p) => p.id);

  if (ids.length === 0) return res.json([]);

  const documentos = await db
    .selectFrom("Evidence")
    .leftJoin("OnChainEvent", "OnChainEvent.evidenceId", "Evidence.id")
    .select([
      "Evidence.id as id",
      "Evidence.originalFilename as filename",
      "Evidence.category as category",
      "Evidence.authoritative as authoritative",
      "Evidence.sha256Hash as sha256Hash",
      "Evidence.uploadedAt as uploadedAt",
      "OnChainEvent.txid as txid",
      "OnChainEvent.status as anchorStatus"
    ])
    .where("Evidence.projectId", "in", ids)
    .orderBy("Evidence.uploadedAt", "desc")
    .execute();

  const filtrados =
    parsed.data.status === "anchored"
      ? documentos.filter((d) => d.txid !== null)
      : parsed.data.status === "pending"
        ? documentos.filter((d) => d.txid === null)
        : documentos;

  return res.json(filtrados);
});

/**
 * Fila 49 — el audit log, paginado por cursor.
 *
 * **Append-only** (M2-D4 P6): los eventos no se editan ni se borran. Si un
 * stage se re-ancla tras una remediación, el evento original queda y se agrega
 * uno nuevo. Esta ruta solo lee.
 */
router.get("/developer/audit-log", async (req, res) => {
  const schema = z.object({
    category: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  let query = db
    .selectFrom("AuditLog")
    .leftJoin("User", "User.id", "AuditLog.actorUserId")
    .select([
      "AuditLog.id as id",
      "AuditLog.action as action",
      "AuditLog.entityType as entityType",
      "AuditLog.entityId as entityId",
      "AuditLog.metadataJson as metadataJson",
      "AuditLog.createdAt as createdAt",
      "User.fullName as actorName",
      "User.role as actorRole"
    ])
    .orderBy("AuditLog.createdAt", "desc")
    .limit(parsed.data.limit);

  if (parsed.data.category) {
    query = query.where("AuditLog.entityType", "=", parsed.data.category);
  }
  if (parsed.data.cursor) {
    query = query.where("AuditLog.createdAt", "<", new Date(parsed.data.cursor));
  }

  const items = await query.execute();
  const ultima = items.at(-1);

  return res.json({
    items,
    nextCursor: ultima ? new Date(ultima.createdAt).toISOString() : null
  });
});

export default router;
