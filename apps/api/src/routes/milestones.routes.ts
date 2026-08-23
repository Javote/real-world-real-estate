import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { db } from "../lib/db";
import {
  ANY_MEMBERSHIP,
  authenticate,
  requireProjectAccess,
  requireRole
} from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.use(authenticate);

router.get(
  "/projects/:id/milestones",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const result = await db
      .selectFrom("Milestone")
      .selectAll()
      .where("projectId", "=", req.params.id)
      .orderBy("sequenceOrder", "asc")
      .execute();

    return res.json(result);
  }
);

router.post(
  "/projects/:id/milestones",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.object({
      name: z.string().min(1),
      sequenceOrder: z.number().int().positive(),
      state: z.enum(["Pending", "InProgress", "Completed", "Observed"]).optional(),
      validationCritical: z.boolean().optional(),
      scopeType: z.string().optional(),
      scopeUnitCount: z.number().int().nonnegative().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const now = new Date();

    const milestone = await db
      .insertInto("Milestone")
      .values({
        id: createId(),
        projectId: req.params.id,
        name: parsed.data.name,
        sequenceOrder: parsed.data.sequenceOrder,
        state: parsed.data.state ?? "Pending",
        validationCritical: parsed.data.validationCritical ?? false,
        scopeType: parsed.data.scopeType ?? "project_wide",
        scopeUnitCount: parsed.data.scopeUnitCount ?? 0,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_MILESTONE",
      entityType: "Milestone",
      entityId: milestone.id
    });

    return res.status(201).json(milestone);
  }
);

router.get(
  "/milestones/:id",
  requireProjectAccess({ via: "Milestone", param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const milestone = await db
      .selectFrom("Milestone")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const [evidences, project] = await Promise.all([
      db.selectFrom("Evidence").selectAll().where("milestoneId", "=", milestone.id).execute(),
      db.selectFrom("Project").selectAll().where("id", "=", milestone.projectId).executeTakeFirst()
    ]);

    return res.json({ ...milestone, evidences, project });
  }
);

router.patch(
  "/milestones/:id",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Milestone", param: "id" }, ["developer"]),
  async (req, res) => {
    const milestoneExisting = await db
      .selectFrom("Milestone")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!milestoneExisting) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      sequenceOrder: z.number().int().positive().optional(),
      validationCritical: z.boolean().optional(),
      scopeType: z.string().optional(),
      scopeUnitCount: z.number().int().nonnegative().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const milestone = await db
      .updateTable("Milestone")
      .set({ ...parsed.data, updatedAt: new Date() })
      .where("id", "=", req.params.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_MILESTONE",
      entityType: "Milestone",
      entityId: milestone.id
    });

    return res.json(milestone);
  }
);

router.patch(
  "/milestones/:id/state",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Milestone", param: "id" }, ["developer"]),
  async (req, res) => {
    const schema = z.object({
      state: z.enum(["Pending", "InProgress", "Completed", "Observed"])
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const existing = await db
      .selectFrom("Milestone")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!existing) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const data: {
      state: typeof parsed.data.state;
      updatedAt: Date;
      certifiedAt?: Date;
      certifiedById?: string;
    } = {
      state: parsed.data.state,
      updatedAt: new Date()
    };

    if (parsed.data.state === "Completed") {
      data.certifiedAt = new Date();
      data.certifiedById = req.user!.id;
    }

    const milestone = await db
      .updateTable("Milestone")
      .set(data)
      .where("id", "=", req.params.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CHANGE_MILESTONE_STATE",
      entityType: "Milestone",
      entityId: milestone.id,
      metadata: { state: parsed.data.state }
    });

    return res.json(milestone);
  }
);

router.delete(
  "/milestones/:id",
  requireRole("admin"),
  async (req: Request<{ id: string }>, res) => {
    await db.deleteFrom("Milestone").where("id", "=", req.params.id).execute();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "DELETE_MILESTONE",
      entityType: "Milestone",
      entityId: req.params.id
    });

    return res.status(204).send();
  }
);

export default router;
