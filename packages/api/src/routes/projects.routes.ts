import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { milestones, projectMembers, projects } from "../db/schema";
import { db } from "../lib/db";
import {
  authenticate,
  ANY_MEMBERSHIP,
  canAccessProject,
  projectScope,
  requireRole
} from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  const { status, city } = req.query;

  // El scope de visibilidad sale de `projectScope` y no de un query propio: es
  // la MISMA regla que aplica `canAccessProject` a un proyecto puntual. Antes
  // esta ruta tenía su propia implementación —traía todas las membresías del
  // usuario y filtraba en JS— que daba el mismo resultado por casualidad.
  //
  // Al unificarlas se cayeron dos cosas que la copia hacía mal y nadie miraba:
  // el listado de un no-admin salía en orden de membresía en vez de por fecha, y
  // un usuario con dos membresías en el mismo proyecto lo veía DUPLICADO (el
  // schema permite developer + buyer sobre el mismo proyecto). `projectScope`
  // usa un EXISTS correlacionado, así que no duplica.
  //
  // Nota de implementación: el listado NO usa la Relational Query API
  // (`db.query.projects.findMany`) porque esa API alias-ea la tabla base
  // (`"Project" AS "projects"`) y la condición de `projectScope` referencia la
  // columna del schema importado sin ese alias — Drizzle no reescribe un `SQL`
  // a medida para calzar con su propio alias interno, así que el EXISTS
  // correlacionado sale apuntando a una tabla que no está en scope
  // ("no such column: Project.id"). Con `db.select().from(projects)` no hay
  // alias de por medio, así que se arma en dos pasos: los proyectos filtrados
  // (con su orden final) y los milestones de esos proyectos, agrupados en JS.
  const projectRows = await db
    .select()
    .from(projects)
    .where(
      and(
        status ? eq(projects.status, String(status) as any) : undefined,
        city ? eq(projects.city, String(city)) : undefined,
        projectScope(req.user!.role, req.user!.id, ANY_MEMBERSHIP)
      )
    )
    .orderBy(desc(projects.createdAt));

  const projectIds = projectRows.map((p) => p.id);
  const milestoneRows = projectIds.length
    ? await db
        .select()
        .from(milestones)
        .where(inArray(milestones.projectId, projectIds))
        .orderBy(asc(milestones.sequenceOrder))
    : [];

  const milestonesByProject = new Map<string, typeof milestoneRows>();
  for (const milestone of milestoneRows) {
    const list = milestonesByProject.get(milestone.projectId) ?? [];
    list.push(milestone);
    milestonesByProject.set(milestone.projectId, list);
  }

  const projectList = projectRows.map((project) => ({
    ...project,
    milestones: milestonesByProject.get(project.id) ?? []
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
    status: z.enum(["planning", "in_progress", "delayed", "completed"]).default(
      "planning"
    )
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const [project] = await db
    .insert(projects)
    .values({
      ...parsed.data,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : undefined
    })
    .returning();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "CREATE_PROJECT",
    entityType: "Project",
    entityId: project.id
  });

  return res.status(201).json(project);
});

router.get("/:id", async (req, res) => {
  const allowed = await canAccessProject(
    req.user!.id,
    req.user!.role,
    req.params.id,
    ANY_MEMBERSHIP
  );

  if (!allowed) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, req.params.id),
    with: {
      milestones: {
        orderBy: asc(milestones.sequenceOrder)
      },
      members: {
        with: {
          user: {
            columns: {
              id: true,
              email: true,
              fullName: true,
              role: true
            }
          }
        }
      }
    }
  });

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  return res.json(project);
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

  const [project] = await db
    .update(projects)
    .set({
      ...parsed.data,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : undefined
    })
    .where(eq(projects.id, req.params.id))
    .returning();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "UPDATE_PROJECT",
    entityType: "Project",
    entityId: project.id
  });

  return res.json(project);
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  await db.delete(projects).where(eq(projects.id, req.params.id));

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "DELETE_PROJECT",
    entityType: "Project",
    entityId: req.params.id
  });

  return res.status(204).send();
});

router.get("/:id/members", async (req, res) => {
  const allowed = await canAccessProject(
    req.user!.id,
    req.user!.role,
    req.params.id,
    ANY_MEMBERSHIP
  );

  if (!allowed) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const members = await db.query.projectMembers.findMany({
    where: eq(projectMembers.projectId, req.params.id),
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          fullName: true,
          role: true
        }
      }
    }
  });

  return res.json(members);
});

router.post("/:id/members", requireRole("admin"), async (req, res) => {
  const schema = z.object({
    userId: z.string().min(1),
    membershipRole: z.enum(["developer", "buyer", "verifier"])
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const [member] = await db
    .insert(projectMembers)
    .values({
      userId: parsed.data.userId,
      projectId: req.params.id,
      membershipRole: parsed.data.membershipRole
    })
    .returning();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "ADD_PROJECT_MEMBER",
    entityType: "ProjectMember",
    entityId: member.id
  });

  return res.status(201).json(member);
});

export default router;
