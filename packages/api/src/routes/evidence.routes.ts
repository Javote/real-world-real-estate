import fs from "fs";
import path from "path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
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

  const evidence = await prisma.evidence.findMany({
    where: { projectId: req.params.id },
    orderBy: { uploadedAt: "desc" },
    omit: { storagePath: true },
    include: {
      milestone: true,
      uploadedBy: {
        select: {
          id: true,
          email: true,
          fullName: true
        }
      }
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

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Project not found" });
    }

    if (parsed.data.milestoneId) {
      const milestone = await prisma.milestone.findFirst({
        where: {
          id: parsed.data.milestoneId,
          projectId
        }
      });

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

    const evidence = await prisma.evidence.create({
      data: {
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
      },
      omit: { storagePath: true }
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_EVIDENCE",
      entityType: "Evidence",
      entityId: evidence.id
    });

    return res.status(201).json(evidence);
  }
);

router.get("/evidence/:id", async (req, res) => {
  const evidence = await prisma.evidence.findUnique({
    where: { id: req.params.id },
    omit: { storagePath: true },
    include: {
      project: true,
      milestone: true,
      uploadedBy: {
        select: {
          id: true,
          email: true,
          fullName: true
        }
      }
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
  const evidence = await prisma.evidence.findUnique({
    where: { id: req.params.id }
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

  if (!fs.existsSync(evidence.storagePath)) {
    return res.status(404).json({ message: "Stored file not found" });
  }

  return res.download(evidence.storagePath, evidence.originalFilename);
});

router.patch("/evidence/:id", requireRole("admin", "developer"), async (req, res) => {
  const existing = await prisma.evidence.findUnique({
    where: { id: req.params.id }
  });

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
    const milestone = await prisma.milestone.findFirst({
      where: {
        id: parsed.data.milestoneId,
        projectId: existing.projectId
      }
    });

    if (!milestone) {
      return res.status(400).json({
        message: "Milestone does not belong to project"
      });
    }
  }

  const evidence = await prisma.evidence.update({
    where: { id: req.params.id },
    data: parsed.data,
    omit: { storagePath: true }
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "UPDATE_EVIDENCE",
    entityType: "Evidence",
    entityId: evidence.id
  });

  return res.json(evidence);
});

router.delete("/evidence/:id", requireRole("admin"), async (req, res) => {
  const existing = await prisma.evidence.findUnique({
    where: { id: req.params.id }
  });

  if (!existing) {
    return res.status(404).json({ message: "Evidence not found" });
  }

  if (fs.existsSync(existing.storagePath)) {
    fs.unlinkSync(existing.storagePath);
  }

  await prisma.evidence.delete({
    where: { id: req.params.id }
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "DELETE_EVIDENCE",
    entityType: "Evidence",
    entityId: req.params.id
  });

  return res.status(204).send();
});

export default router;
