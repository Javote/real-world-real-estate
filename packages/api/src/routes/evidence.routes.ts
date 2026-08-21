import fs from "fs";
import path from "path";
import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { evidences, milestones, projects } from "../db/schema";
import { db } from "../lib/db";
import { uploadSingleEvidence } from "../lib/upload";
import {
  authenticate,
  ANY_MEMBERSHIP,
  canAccessProject,
  requireRole
} from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { sha256File } from "../utils/hashing";

const router = Router();

router.use(authenticate);

// `storagePath` NUNCA sale al cliente (D-011, incidente real de filtración de
// ruta absoluta en disco). Toda query que arma una respuesta usa esta lista de
// columnas explícita en vez de "select *" / traer la fila entera. Las dos rutas
// internas que sí necesitan `storagePath` (`download`, `delete`) consultan la
// fila completa aparte, y nunca la devuelven en el body.
const EVIDENCE_SAFE_COLUMNS = {
  storagePath: false
} as const;

const UPLOADED_BY_COLUMNS = {
  id: true,
  email: true,
  fullName: true
} as const;

router.get("/projects/:id/evidence", async (req, res) => {
  const allowed = await canAccessProject(
    req.user!.id,
    req.user!.role,
    req.params.id,
    ANY_MEMBERSHIP
  );

  if (!allowed) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const evidence = await db.query.evidences.findMany({
    where: eq(evidences.projectId, req.params.id),
    orderBy: desc(evidences.uploadedAt),
    columns: EVIDENCE_SAFE_COLUMNS,
    with: {
      milestone: true,
      uploadedBy: { columns: UPLOADED_BY_COLUMNS }
    }
  });

  return res.json(evidence);
});

router.post(
  "/projects/:id/evidence",
  requireRole("admin", "developer"),
  (req, res, next) => {
    uploadSingleEvidence(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  },
  async (req, res) => {
    const projectId = req.params.id;

    const allowed = await canAccessProject(
      req.user!.id,
      req.user!.role,
      projectId,
      ["developer"]
    );

    if (!allowed) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const schema = z.object({
      milestoneId: z.string().optional(),
      evidenceType: z.enum(["document", "photo", "certificate"]),
      category: z.string().min(1),
      authoritative: z
        .string()
        .optional()
        .transform((v) => v === "true")
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json(parsed.error.flatten());
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));

    if (!project) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Project not found" });
    }

    if (parsed.data.milestoneId) {
      const [milestone] = await db
        .select({ id: milestones.id })
        .from(milestones)
        .where(and(eq(milestones.id, parsed.data.milestoneId), eq(milestones.projectId, projectId)));

      if (!milestone) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          message: "Milestone does not belong to project"
        });
      }
    }

    const absolutePath = path.resolve(req.file.path);
    const sha256Hash = await sha256File(absolutePath);

    const [created] = await db
      .insert(evidences)
      .values({
        projectId,
        milestoneId: parsed.data.milestoneId ?? null,
        uploadedById: req.user!.id,
        evidenceType: parsed.data.evidenceType,
        category: parsed.data.category,
        authoritative: parsed.data.authoritative ?? false,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: absolutePath,
        sha256Hash
      })
      .returning({ id: evidences.id });

    const evidence = await db.query.evidences.findFirst({
      where: eq(evidences.id, created.id),
      columns: EVIDENCE_SAFE_COLUMNS
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_EVIDENCE",
      entityType: "Evidence",
      entityId: created.id
    });

    return res.status(201).json(evidence);
  }
);

router.get("/evidence/:id", async (req, res) => {
  const evidence = await db.query.evidences.findFirst({
    where: eq(evidences.id, req.params.id),
    columns: EVIDENCE_SAFE_COLUMNS,
    with: {
      project: true,
      milestone: true,
      uploadedBy: { columns: UPLOADED_BY_COLUMNS }
    }
  });

  if (!evidence) {
    return res.status(404).json({ message: "Evidence not found" });
  }

  const allowed = await canAccessProject(
    req.user!.id,
    req.user!.role,
    evidence.projectId,
    ANY_MEMBERSHIP
  );

  if (!allowed) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return res.json(evidence);
});

router.get("/evidence/:id/download", async (req, res) => {
  const [evidence] = await db.select().from(evidences).where(eq(evidences.id, req.params.id));

  if (!evidence) {
    return res.status(404).json({ message: "Evidence not found" });
  }

  const allowed = await canAccessProject(
    req.user!.id,
    req.user!.role,
    evidence.projectId,
    ANY_MEMBERSHIP
  );

  if (!allowed) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!fs.existsSync(evidence.storagePath)) {
    return res.status(404).json({ message: "Stored file not found" });
  }

  return res.download(evidence.storagePath, evidence.originalFilename);
});

router.patch("/evidence/:id", requireRole("admin", "developer"), async (req, res) => {
  const [existing] = await db.select().from(evidences).where(eq(evidences.id, req.params.id));

  if (!existing) {
    return res.status(404).json({ message: "Evidence not found" });
  }

  const allowed = await canAccessProject(
    req.user!.id,
    req.user!.role,
    existing.projectId,
    ["developer"]
  );

  if (!allowed) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const schema = z.object({
    category: z.string().min(1).optional(),
    authoritative: z.boolean().optional(),
    evidenceType: z.enum(["document", "photo", "certificate"]).optional(),
    milestoneId: z.string().nullable().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  if (parsed.data.milestoneId) {
    const [milestone] = await db
      .select({ id: milestones.id })
      .from(milestones)
      .where(
        and(eq(milestones.id, parsed.data.milestoneId), eq(milestones.projectId, existing.projectId))
      );

    if (!milestone) {
      return res.status(400).json({
        message: "Milestone does not belong to project"
      });
    }
  }

  await db.update(evidences).set(parsed.data).where(eq(evidences.id, req.params.id));

  const evidence = await db.query.evidences.findFirst({
    where: eq(evidences.id, req.params.id),
    columns: EVIDENCE_SAFE_COLUMNS
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "UPDATE_EVIDENCE",
    entityType: "Evidence",
    entityId: req.params.id
  });

  return res.json(evidence);
});

router.delete("/evidence/:id", requireRole("admin"), async (req, res) => {
  const [existing] = await db.select().from(evidences).where(eq(evidences.id, req.params.id));

  if (!existing) {
    return res.status(404).json({ message: "Evidence not found" });
  }

  if (fs.existsSync(existing.storagePath)) {
    fs.unlinkSync(existing.storagePath);
  }

  await db.delete(evidences).where(eq(evidences.id, req.params.id));

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "DELETE_EVIDENCE",
    entityType: "Evidence",
    entityId: req.params.id
  });

  return res.status(204).send();
});

export default router;
