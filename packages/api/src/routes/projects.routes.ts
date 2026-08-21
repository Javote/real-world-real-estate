import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
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
  // schema permite developer + buyer sobre el mismo proyecto).
  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status: String(status) as any } : {}),
      ...(city ? { city: String(city) } : {}),
      ...projectScope(req.user!.role, req.user!.id, ANY_MEMBERSHIP)
    },
    include: {
      milestones: {
        orderBy: { sequenceOrder: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json(projects);
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

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : undefined
    }
  });

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

  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      milestones: {
        orderBy: { sequenceOrder: "asc" }
      },
      members: {
        include: {
          user: {
            select: {
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

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : undefined
    }
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "UPDATE_PROJECT",
    entityType: "Project",
    entityId: project.id
  });

  return res.json(project);
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  await prisma.project.delete({
    where: { id: req.params.id }
  });

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

  const members = await prisma.projectMember.findMany({
    where: { projectId: req.params.id },
    include: {
      user: {
        select: {
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

  const member = await prisma.projectMember.create({
    data: {
      userId: parsed.data.userId,
      projectId: req.params.id,
      membershipRole: parsed.data.membershipRole
    }
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "ADD_PROJECT_MEMBER",
    entityType: "ProjectMember",
    entityId: member.id
  });

  return res.status(201).json(member);
});

export default router;
