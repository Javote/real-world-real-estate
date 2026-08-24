import fs from "node:fs";
import path from "node:path";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { anchorPort } from "../lib/anchor";
import { db } from "../lib/db";
import { storage } from "../lib/storage";
import { uploadSingleEvidence } from "../lib/upload";
import {
  ANY_MEMBERSHIP,
  authenticate,
  requireProjectAccess,
  requireRole
} from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

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
  "stageId",
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
      .leftJoin("Stage", "Stage.id", "Evidence.stageId")
      .select([
        ...EVIDENCE_SAFE_COLUMNS.map((c) => `Evidence.${c}` as const),
        "User.id as uploadedBy_id",
        "User.email as uploadedBy_email",
        "User.fullName as uploadedBy_fullName",
        "Stage.id as stage_id",
        "Stage.projectId as stage_projectId",
        "Stage.name as stage_name",
        "Stage.sequenceOrder as stage_sequenceOrder",
        "Stage.state as stage_state",
        "Stage.validationCritical as stage_validationCritical",
        "Stage.certifiedAt as stage_certifiedAt",
        "Stage.certifiedById as stage_certifiedById",
        "Stage.createdAt as stage_createdAt",
        "Stage.updatedAt as stage_updatedAt"
      ])
      .where("Evidence.projectId", "=", req.params.id)
      .orderBy("Evidence.uploadedAt", "desc")
      .execute();

    const evidence = rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      stageId: row.stageId,
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
      stage: row.stage_id
        ? {
            id: row.stage_id,
            projectId: row.stage_projectId,
            name: row.stage_name,
            sequenceOrder: row.stage_sequenceOrder,
            state: row.stage_state,
            validationCritical: row.stage_validationCritical,
            certifiedAt: row.stage_certifiedAt,
            certifiedById: row.stage_certifiedById,
            createdAt: row.stage_createdAt,
            updatedAt: row.stage_updatedAt
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
      stageId: z.string().optional(),
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

    if (parsed.data.stageId) {
      const stage = await db
        .selectFrom("Stage")
        .select("id")
        .where("id", "=", parsed.data.stageId)
        .where("projectId", "=", projectId)
        .executeTakeFirst();

      if (!stage) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          message: "Stage does not belong to project"
        });
      }
    }

    // El archivo pasa por disco (Multer) y de ahí al storage configurado. El
    // hash que se guarda es el de **los bytes guardados**, no el del temporal:
    // con `s3`, `put` relee el objeto y lo rehashea. Ver `lib/storage.ts`.
    const guardado = await storage.put({
      localPath: path.resolve(req.file.path),
      key: `evidence/${projectId}/${req.file.filename}`,
      contentType: req.file.mimetype
    });

    // Con `s3` el temporal ya cumplió su función; con `disk` el "temporal" ES
    // el destino, así que no se borra.
    if (storage.driver === "s3" && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const sha256Hash = guardado.sha256;
    const now = new Date();

    const created = await db
      .insertInto("Evidence")
      .values({
        id: createId(),
        projectId,
        stageId: parsed.data.stageId ?? null,
        uploadedById: req.user!.id,
        evidenceType: parsed.data.evidenceType,
        category: parsed.data.category,
        authoritative: parsed.data.authoritative ?? false,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: guardado.storageRef,
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

    const [project, stage, uploadedBy] = await Promise.all([
      db.selectFrom("Project").selectAll().where("id", "=", evidence.projectId).executeTakeFirst(),
      evidence.stageId
        ? db.selectFrom("Stage").selectAll().where("id", "=", evidence.stageId).executeTakeFirst()
        : Promise.resolve(null),
      db
        .selectFrom("User")
        .select(["id", "email", "fullName"])
        .where("id", "=", evidence.uploadedById)
        .executeTakeFirst()
    ]);

    return res.json({ ...evidence, project, stage, uploadedBy });
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

    if (!(await storage.exists(evidence.storagePath))) {
      return res.status(404).json({ message: "Stored file not found" });
    }

    // Se streamea desde el storage en vez de `res.download`: con `s3` no hay
    // ruta local que pasarle, y el nombre visible sale del registro, no del
    // objeto guardado.
    res.setHeader("Content-Type", evidence.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(evidence.originalFilename)}"`
    );
    const contenido = await storage.read(evidence.storagePath);
    return contenido.pipe(res);
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
      stageId: z.string().nullable().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    if (parsed.data.stageId) {
      const stage = await db
        .selectFrom("Stage")
        .select("id")
        .where("id", "=", parsed.data.stageId)
        .where("projectId", "=", existing.projectId)
        .executeTakeFirst();

      if (!stage) {
        return res.status(400).json({
          message: "Stage does not belong to project"
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

/**
 * **Anclar el hash de un archivo. Lo dispara el admin, nunca el upload** (D-061).
 *
 * Es el camino `Evidence Anchor Transactions` de `M1-D2/1-system-architecture`:
 * metadata suelta (label 1904, D-006), sin validador. Prueba *este archivo
 * existía a esta hora* — no que un stage avanzó, que es lo que prueba el hilo.
 *
 * Por qué manual: una vez en la cadena no se borra. Anclar en el upload
 * anclaría borradores, archivos subidos por error y versiones que todavía no
 * son la buena. Y M2-D4 §6.3 pide que toda superficie de prueba la inicie el
 * usuario.
 *
 * Idempotente (regla 8): si ese archivo ya tiene su anclaje, devuelve el mismo
 * evento en vez de gastar otra transacción.
 */
router.post(
  "/evidence/:id/anchor",
  requireRole("admin"),
  requireProjectAccess({ via: "Evidence", param: "id" }, ANY_MEMBERSHIP),
  async (req: Request<{ id: string }>, res) => {
    const evidencia = await db
      .selectFrom("Evidence")
      .select(["id", "projectId", "stageId", "sha256Hash"])
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!evidencia) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    const yaAnclada = await db
      .selectFrom("OnChainEvent")
      .selectAll()
      .where("evidenceId", "=", evidencia.id)
      .where("txid", "is not", null)
      .executeTakeFirst();

    if (yaAnclada) {
      return res.status(200).json(yaAnclada);
    }

    const previo = await db
      .selectFrom("OnChainEvent")
      .select("eventIndex")
      .where("stageId", "=", evidencia.stageId)
      .orderBy("eventIndex", "desc")
      .limit(1)
      .executeTakeFirst();

    const now = new Date();
    const evento = await db
      .insertInto("OnChainEvent")
      .values({
        id: createId(),
        projectId: evidencia.projectId,
        stageId: evidencia.stageId,
        evidenceId: evidencia.id,
        eventIndex: previo ? previo.eventIndex + 1 : 0,
        eventType: "EVIDENCE_ANCHOR",
        fromState: null,
        toState: null,
        commitment: evidencia.sha256Hash,
        status: "Pending",
        txid: null,
        outputRef: null,
        blockTimestamp: null,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    let anclado = evento;
    try {
      const recibo = await anchorPort.anchorEvidence({
        sha256: evidencia.sha256Hash,
        // Ref opaca: el id del registro, nunca el nombre del archivo (regla 2).
        reference: evidencia.id
      });

      anclado = await db
        .updateTable("OnChainEvent")
        .set({ txid: recibo.txid, status: recibo.status, updatedAt: new Date() })
        .where("id", "=", evento.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      console.error("[anchor] el anclaje de evidencia falló", { evidenceId: evidencia.id, error });
      anclado = await db
        .updateTable("OnChainEvent")
        .set({ status: "Failed", updatedAt: new Date() })
        .where("id", "=", evento.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "ANCHOR_EVIDENCE",
      entityType: "Evidence",
      entityId: evidencia.id,
      metadata: { txid: anclado.txid, status: anclado.status }
    });

    return res.status(201).json(anclado);
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

  await storage.remove(existing.storagePath);

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
