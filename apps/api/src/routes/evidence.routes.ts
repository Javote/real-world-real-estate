import fs from "node:fs";
import path from "node:path";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { db } from "../lib/db";
import { uploadSingleEvidence } from "../lib/upload";
import {
  ANY_MEMBERSHIP,
  authenticate,
  requireProjectAccess,
  requireRole
} from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { sha256File } from "../utils/hashing";

const router = Router();

router.use(authenticate);

// `storagePath` NUNCA sale al cliente (D-011, incidente real de filtración de
// ruta absoluta en disco). Toda query que arma una respuesta lista sus columnas
// EXPLÍCITAS en vez de `selectAll()` — es la forma en que Kysely reemplaza el
// `columns: { storagePath: false }` de Drizzle (D-049): acá no hay "excluir",
// solo "incluir", así que una columna nueva en `Evidence` no se filtra sola,
// hay que sumarla a mano a esta lista. Las dos rutas internas que sí necesitan
// `storagePath` (`download`, `delete`) consultan la fila completa aparte, y
// nunca la devuelven en el body.
const EVIDENCE_SAFE_COLUMNS = [
  "id",
  "projectId",
  "milestoneId",
  "uploadedById",
  "evidenceType",
  "category",
  "authoritative",
  "originalFilename",
  "storedFilename",
  "mimeType",
  "sizeBytes",
  "sha256Hash",
  "uploadedAt",
  "createdAt",
  "updatedAt"
] as const;

router.get(
  "/projects/:id/evidence",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const rows = await db
      .selectFrom("Evidence")
      .innerJoin("User", "User.id", "Evidence.uploadedById")
      .leftJoin("Milestone", "Milestone.id", "Evidence.milestoneId")
      .select([
        ...EVIDENCE_SAFE_COLUMNS.map((c) => `Evidence.${c}` as const),
        "User.id as uploadedBy_id",
        "User.email as uploadedBy_email",
        "User.fullName as uploadedBy_fullName",
        "Milestone.id as milestone_id",
        "Milestone.projectId as milestone_projectId",
        "Milestone.name as milestone_name",
        "Milestone.sequenceOrder as milestone_sequenceOrder",
        "Milestone.state as milestone_state",
        "Milestone.validationCritical as milestone_validationCritical",
        "Milestone.certifiedAt as milestone_certifiedAt",
        "Milestone.certifiedById as milestone_certifiedById",
        "Milestone.scopeType as milestone_scopeType",
        "Milestone.scopeUnitCount as milestone_scopeUnitCount",
        "Milestone.createdAt as milestone_createdAt",
        "Milestone.updatedAt as milestone_updatedAt"
      ])
      .where("Evidence.projectId", "=", req.params.id)
      .orderBy("Evidence.uploadedAt", "desc")
      .execute();

    const evidence = rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      milestoneId: row.milestoneId,
      uploadedById: row.uploadedById,
      evidenceType: row.evidenceType,
      category: row.category,
      authoritative: row.authoritative,
      originalFilename: row.originalFilename,
      storedFilename: row.storedFilename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sha256Hash: row.sha256Hash,
      uploadedAt: row.uploadedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      uploadedBy: {
        id: row.uploadedBy_id,
        email: row.uploadedBy_email,
        fullName: row.uploadedBy_fullName
      },
      milestone: row.milestone_id
        ? {
            id: row.milestone_id,
            projectId: row.milestone_projectId,
            name: row.milestone_name,
            sequenceOrder: row.milestone_sequenceOrder,
            state: row.milestone_state,
            validationCritical: row.milestone_validationCritical,
            certifiedAt: row.milestone_certifiedAt,
            certifiedById: row.milestone_certifiedById,
            scopeType: row.milestone_scopeType,
            scopeUnitCount: row.milestone_scopeUnitCount,
            createdAt: row.milestone_createdAt,
            updatedAt: row.milestone_updatedAt
          }
        : null
    }));

    return res.json(evidence);
  }
);

router.post(
  "/projects/:id/evidence",
  requireRole("admin", "developer"),
  // Antes de Multer a propósito: un request prohibido no llega a escribir el
  // archivo, así que no hay huérfano que limpiar por esta vía. La limpieza de
  // huérfanos sigue haciendo falta para lo que se rechaza DESPUÉS de Multer
  // (tipo, tamaño, y los errores de la ruta) — ver SPEC-012.
  requireProjectAccess({ param: "id" }, ["developer"]),
  (req, res, next) => {
    uploadSingleEvidence(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  },
  async (req: Request<{ id: string }>, res) => {
    const projectId = req.params.id;

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

    const project = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", projectId)
      .executeTakeFirst();

    if (!project) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Project not found" });
    }

    if (parsed.data.milestoneId) {
      const milestone = await db
        .selectFrom("Milestone")
        .select("id")
        .where("id", "=", parsed.data.milestoneId)
        .where("projectId", "=", projectId)
        .executeTakeFirst();

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
    const now = new Date();

    const created = await db
      .insertInto("Evidence")
      .values({
        id: createId(),
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
        sha256Hash,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", created.id)
      .executeTakeFirst();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_EVIDENCE",
      entityType: "Evidence",
      entityId: created.id
    });

    return res.status(201).json(evidence);
  }
);

router.get(
  "/evidence/:id",
  requireProjectAccess({ via: "Evidence", param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    const [project, milestone, uploadedBy] = await Promise.all([
      db.selectFrom("Project").selectAll().where("id", "=", evidence.projectId).executeTakeFirst(),
      evidence.milestoneId
        ? db
            .selectFrom("Milestone")
            .selectAll()
            .where("id", "=", evidence.milestoneId)
            .executeTakeFirst()
        : Promise.resolve(null),
      db
        .selectFrom("User")
        .select(["id", "email", "fullName"])
        .where("id", "=", evidence.uploadedById)
        .executeTakeFirst()
    ]);

    return res.json({ ...evidence, project, milestone, uploadedBy });
  }
);

router.get(
  "/evidence/:id/download",
  requireProjectAccess({ via: "Evidence", param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const evidence = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    if (!fs.existsSync(evidence.storagePath)) {
      return res.status(404).json({ message: "Stored file not found" });
    }

    return res.download(evidence.storagePath, evidence.originalFilename);
  }
);

router.patch(
  "/evidence/:id",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Evidence", param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const existing = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!existing) {
      return res.status(404).json({ message: "Evidence not found" });
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
      const milestone = await db
        .selectFrom("Milestone")
        .select("id")
        .where("id", "=", parsed.data.milestoneId)
        .where("projectId", "=", existing.projectId)
        .executeTakeFirst();

      if (!milestone) {
        return res.status(400).json({
          message: "Milestone does not belong to project"
        });
      }
    }

    await db
      .updateTable("Evidence")
      .set({ ...parsed.data, updatedAt: new Date() })
      .where("id", "=", req.params.id)
      .execute();

    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_EVIDENCE",
      entityType: "Evidence",
      entityId: req.params.id
    });

    return res.json(evidence);
  }
);

router.delete("/evidence/:id", requireRole("admin"), async (req: Request<{ id: string }>, res) => {
  const existing = await db
    .selectFrom("Evidence")
    .selectAll()
    .where("id", "=", req.params.id)
    .executeTakeFirst();

  if (!existing) {
    return res.status(404).json({ message: "Evidence not found" });
  }

  if (fs.existsSync(existing.storagePath)) {
    fs.unlinkSync(existing.storagePath);
  }

  await db.deleteFrom("Evidence").where("id", "=", req.params.id).execute();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "DELETE_EVIDENCE",
    entityType: "Evidence",
    entityId: req.params.id
  });

  return res.status(204).send();
});

export default router;
