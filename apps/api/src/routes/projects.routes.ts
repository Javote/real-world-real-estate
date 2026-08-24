import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { PROJECT_STATUSES } from "../db/types";
import { db } from "../lib/db";
import {
  ANY_MEMBERSHIP,
  authenticate,
  projectScope,
  requireProjectAccess,
  requireRole
} from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.use(authenticate);

/**
 * Filtros de `GET /projects`. La regla 6 pide Zod en todo lo que entra, y este
 * es el único endpoint donde lo que entra es la query y no el body — se había
 * quedado afuera, con un `String(status) as any` que le mentía al compilador:
 * `status` podía ser cualquier cosa y Kysely lo tomaba como un `ProjectStatus`.
 * No era explotable (SQLite compara contra un valor que no existe y no devuelve
 * nada), pero es exactamente el agujero que la regla 6 cierra.
 *
 * Los dos son opcionales y un valor inválido es 400, no un filtro ignorado en
 * silencio: quien filtra por `status=activo` tiene que enterarse de que ese
 * estado no existe.
 */
const listQuerySchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  city: z.string().min(1).optional()
});

router.get("/", async (req, res) => {
  const filtros = listQuerySchema.safeParse(req.query);

  if (!filtros.success) {
    return res.status(400).json(filtros.error.flatten());
  }

  const { status, city } = filtros.data;

  // El scope de visibilidad sale de `projectScope` y no de un query propio: es
  // la MISMA regla que aplica `canAccessProject` a un proyecto puntual (D-048,
  // D-049 — reimplementado con el query builder de Kysely, misma semántica:
  // `EXISTS` correlacionado, sin duplicar filas de un usuario con dos
  // membresías sobre el mismo proyecto).
  let query = db.selectFrom("Project").selectAll("Project");

  if (status) query = query.where("status", "=", status);
  if (city) query = query.where("city", "=", city);

  const projectRows = await query
    .where((eb) => projectScope(eb, req.user!.role, req.user!.id, ANY_MEMBERSHIP))
    .orderBy("createdAt", "desc")
    .execute();

  const projectIds = projectRows.map((p) => p.id);
  const stageRows = projectIds.length
    ? await db
        .selectFrom("Stage")
        .selectAll()
        .where("projectId", "in", projectIds)
        .orderBy("sequenceOrder", "asc")
        .execute()
    : [];

  const stagesByProject = new Map<string, typeof stageRows>();
  for (const stage of stageRows) {
    const list = stagesByProject.get(stage.projectId) ?? [];
    list.push(stage);
    stagesByProject.set(stage.projectId, list);
  }

  const projectList = projectRows.map((project) => ({
    ...project,
    stages: stagesByProject.get(project.id) ?? []
  }));

  return res.json(projectList);
});

router.post("/", requireRole("admin"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    totalUnits: z.number().int().nonnegative().default(0),
    estimatedDelivery: z.string().datetime().optional(),
    status: z.enum(["planning", "in_progress", "delayed", "completed"]).default("planning")
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const now = new Date();

  const project = await db
    .insertInto("Project")
    .values({
      id: createId(),
      name: parsed.data.name,
      slug: parsed.data.slug,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      country: parsed.data.country ?? null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      totalUnits: parsed.data.totalUnits,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : null,
      status: parsed.data.status,
      createdAt: now,
      updatedAt: now
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "CREATE_PROJECT",
    entityType: "Project",
    entityId: project.id
  });

  return res.status(201).json(project);
});

router.get("/:id", requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP), async (req, res) => {
  const project = await db
    .selectFrom("Project")
    .selectAll()
    .where("id", "=", req.params.id)
    .executeTakeFirst();

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  const stageRows = await db
    .selectFrom("Stage")
    .selectAll()
    .where("projectId", "=", project.id)
    .orderBy("sequenceOrder", "asc")
    .execute();

  const memberRows = await db
    .selectFrom("ProjectMember")
    .innerJoin("User", "User.id", "ProjectMember.userId")
    .select([
      "ProjectMember.id",
      "ProjectMember.userId",
      "ProjectMember.projectId",
      "ProjectMember.membershipRole",
      "ProjectMember.createdAt",
      "User.id as user_id",
      "User.email as user_email",
      "User.fullName as user_fullName",
      "User.role as user_role"
    ])
    .where("ProjectMember.projectId", "=", project.id)
    .execute();

  const members = memberRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    membershipRole: row.membershipRole,
    createdAt: row.createdAt,
    user: {
      id: row.user_id,
      email: row.user_email,
      fullName: row.user_fullName,
      role: row.user_role
    }
  }));

  return res.json({ ...project, stages: stageRows, members });
});

router.patch("/:id", requireRole("admin"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    totalUnits: z.number().int().nonnegative().optional(),
    estimatedDelivery: z.string().datetime().optional(),
    status: z.enum(["planning", "in_progress", "delayed", "completed"]).optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const project = await db
    .updateTable("Project")
    .set({
      ...parsed.data,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : undefined,
      updatedAt: new Date()
    })
    .where("id", "=", req.params.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "UPDATE_PROJECT",
    entityType: "Project",
    entityId: project.id
  });

  return res.json(project);
});

router.delete("/:id", requireRole("admin"), async (req: Request<{ id: string }>, res) => {
  await db.deleteFrom("Project").where("id", "=", req.params.id).execute();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "DELETE_PROJECT",
    entityType: "Project",
    entityId: req.params.id
  });

  return res.status(204).send();
});

router.get(
  "/:id/members",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const memberRows = await db
      .selectFrom("ProjectMember")
      .innerJoin("User", "User.id", "ProjectMember.userId")
      .select([
        "ProjectMember.id",
        "ProjectMember.userId",
        "ProjectMember.projectId",
        "ProjectMember.membershipRole",
        "ProjectMember.createdAt",
        "User.id as user_id",
        "User.email as user_email",
        "User.fullName as user_fullName",
        "User.role as user_role"
      ])
      .where("ProjectMember.projectId", "=", req.params.id)
      .execute();

    const members = memberRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      projectId: row.projectId,
      membershipRole: row.membershipRole,
      createdAt: row.createdAt,
      user: {
        id: row.user_id,
        email: row.user_email,
        fullName: row.user_fullName,
        role: row.user_role
      }
    }));

    return res.json(members);
  }
);

router.post("/:id/members", requireRole("admin"), async (req: Request<{ id: string }>, res) => {
  const schema = z.object({
    userId: z.string().min(1),
    membershipRole: z.enum(["developer", "buyer", "verifier"])
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const member = await db
    .insertInto("ProjectMember")
    .values({
      id: createId(),
      userId: parsed.data.userId,
      projectId: req.params.id,
      membershipRole: parsed.data.membershipRole,
      createdAt: new Date()
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "ADD_PROJECT_MEMBER",
    entityType: "ProjectMember",
    entityId: member.id
  });

  return res.status(201).json(member);
});

export default router;
