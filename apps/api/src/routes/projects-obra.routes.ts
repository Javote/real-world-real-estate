import fs from "node:fs";
import path from "node:path";
import { INITIAL_STAGE_STATE } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { reconciliarParaLectura } from "../domain/reconcile";
import {
  anchorEvent,
  recordOnChainEvent,
  retryStageMint,
  transitionStage
} from "../domain/stage-transition";
import { db } from "../lib/db";
import { storage } from "../lib/storage";
import { uploadSingleEvidence } from "../lib/upload";
import { ANY_MEMBERSHIP, authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared";

// **El registro de obra de un proyecto**: sus stages y su evidencia (M2-D5
// filas 08, 09-12).
//
// Segundo router sobre `/api/v1/projects`. Se separa de `projects.routes.ts`
// —que es el CRUD del proyecto y sus miembros— porque son dos cosas distintas
// con dos lectores distintos: el CRUD lo toca quien administra, esto lo lee
// quien quiere ver el avance y la prueba.
//
// **La FSM del stage no vive acá** (D-020): está en `packages/shared` y espejada
// en Aiken. Estas rutas la consumen vía `domain/stage-transition`.

const router = Router();

router.use(authenticate);

router.get(
  "/:id/stages",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res) => {
    const result = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", req.params.id)
      .orderBy("sequenceOrder", "asc")
      .execute();

    // Una sola query para todo el listado, no una por stage: qué stages de
    // este proyecto tienen un UTxO vivo (`cabezaDelHilo`, pero en lote).
    const conHilo = new Set(
      (
        await db
          .selectFrom("OnChainEvent")
          .select("stageId")
          .distinct()
          .where(
            "stageId",
            "in",
            result.map((s) => s.id)
          )
          .where("outputRef", "is not", null)
          .execute()
      ).map((r) => r.stageId)
    );

    return res.json(result.map((stage) => ({ ...stage, hasOnChainThread: conHilo.has(stage.id) })));
  }
);

router.post(
  "/:id/stages",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.object({
      name: z.string().min(1),
      sequenceOrder: z.number().int().positive(),
      // `state` NO se acepta por body: todo stage nace en `Pending`. El
      // handler `mint` del validador lo exige para acuñar el hilo
      // (`valid_initial_datum`), así que dejar elegir el estado inicial acá
      // sería fabricar stages que no se pueden anclar.
      validationCritical: z.boolean().optional(),
      // Avance de obra que este stage representa sobre el 100% del proyecto
      // (D-021, placeholder de M3 §1 — DEFAULT_STAGE_CATALOG). Nunca dinero.
      progressPercentage: z.number().int().min(0).max(100).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const now = new Date();

    const stage = await db
      .insertInto("Stage")
      .values({
        id: createId(),
        projectId: req.params.id,
        name: parsed.data.name,
        sequenceOrder: parsed.data.sequenceOrder,
        state: INITIAL_STAGE_STATE,
        // D-061: todo stage es validation-critical. El default deja de ser un
        // flag que alguien se olvida de marcar; desmarcarlo es explícito.
        validationCritical: parsed.data.validationCritical ?? true,
        progressPercentage: parsed.data.progressPercentage ?? null,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const evento = await recordOnChainEvent({
      projectId: stage.projectId,
      stageId: stage.id,
      eventType: "STAGE_CREATED",
      fromState: null,
      toState: stage.state
    });
    const anchor = await anchorEvent(evento, stage, null);

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_STAGE",
      entityType: "Stage",
      entityId: stage.id
    });

    return res.status(201).json({ ...stage, anchor });
  }
);

/**
 * Reintenta el mint de un stage cuyo `openThread` original falló y quedó sin
 * hilo on-chain — red caída, wallet sin fondos en el instante del mint.
 *
 * No es una superficie de M2-D5: es mantenimiento operativo, como
 * `POST /evidence/reconcile`. Admin-only y **solo mientras el stage siga en
 * `Pending`** (`domain/stage-transition.ts` explica por qué no hay reintento
 * para uno que ya avanzó sin hilo).
 */
router.post(
  "/:id/stages/:stageId/retry-anchor",
  authorize({
    roles: ["admin"],
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req: Request<{ id: string; stageId: string }>, res) => {
    const stage = await db
      .selectFrom("Stage")
      .select("id")
      .where("id", "=", req.params.stageId)
      .where("projectId", "=", req.params.id)
      .executeTakeFirst();

    if (!stage) {
      return res.status(404).json({ message: "Stage does not belong to project" });
    }

    const result = await retryStageMint(req.params.stageId);
    if (!result.ok) {
      return res.status(result.status).json({ code: result.code });
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "RETRY_STAGE_ANCHOR",
      entityType: "Stage",
      entityId: result.stage.id
    });

    return res.json({ ...result.stage, anchor: result.anchor });
  }
);

/**
 * Fila 09-12 — el mismo detalle de stage bajo el path anidado que el backlog
 * pide (INV-STAGE-DETAIL-001), con el bundle que lo compromete.
 *
 * **404 y no 403 si el stage es de otro proyecto**: el id existe, pero bajo
 * este proyecto no, y confirmar su existencia le diría a alguien con acceso a
 * un proyecto que hay un stage con ese id en otro.
 */
router.get(
  "/:id/stages/:stageId",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req: Request<{ id: string; stageId: string }>, res) => {
    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.stageId)
      .where("projectId", "=", req.params.id)
      .executeTakeFirst();

    if (!stage) return res.status(404).json({ message: "Stage not found" });

    // Antes de leer los eventos, no después: un anclaje `Pending` que ya está en
    // un bloque se confirma acá y la consulta de abajo lo ve `Confirmed`
    // (D-077). Es la pantalla donde se mira la prueba de un stage.
    await reconciliarParaLectura({ stageId: stage.id });

    const [evidences, bundle, eventos] = await Promise.all([
      // Sin `storagePath` (D-011): esta lista sale al cliente.
      db
        .selectFrom("Evidence")
        .select([
          "id",
          "evidenceType",
          "category",
          "authoritative",
          "originalFilename",
          "mimeType",
          "sizeBytes",
          "sha256Hash",
          "uploadedAt"
        ])
        .where("stageId", "=", stage.id)
        .orderBy("uploadedAt", "asc")
        .execute(),
      db
        .selectFrom("EvidenceBundle")
        .select(["id", "commitmentHash", "createdAt"])
        .where("stageId", "=", stage.id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirst(),
      db
        .selectFrom("OnChainEvent")
        .select(["eventType", "toState", "commitment", "txid", "status", "outputRef", "createdAt"])
        .where("stageId", "=", stage.id)
        .orderBy("eventIndex", "asc")
        .execute()
    ]);

    return res.json({
      ...stage,
      evidences,
      bundle: bundle ?? null,
      // Calculado, no guardado (evita una segunda fuente de verdad): el mismo
      // criterio que `cabezaDelHilo`, sin una query aparte porque `eventos` ya
      // trae `outputRef`.
      hasOnChainThread: eventos.some((e) => e.outputRef !== null),
      events: eventos
    });
  }
);

router.get(
  "/:id/evidence",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
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
  "/:id/evidence",
  // Antes de Multer a propósito: un request prohibido no llega a escribir el
  // archivo, así que no hay huérfano que limpiar por esta vía. La limpieza de
  // huérfanos sigue haciendo falta para lo que se rechaza DESPUÉS de Multer
  // (tipo, tamaño, y los errores de la ruta) — ver SPEC-012.
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
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

    let stage: { id: string; state: string } | undefined;
    if (parsed.data.stageId) {
      stage = await db
        .selectFrom("Stage")
        .select(["id", "state"])
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

    // M1-D2c: "Pending → InProgress : work initiated". La primera evidencia
    // que un developer sube a un stage Pending ES la señal de que el trabajo
    // arrancó — no hace falta un botón aparte para decir lo que subir el
    // archivo ya dice. `Observed → InProgress` ("remediation completed") NO
    // se dispara acá a propósito: significaría reabrir el stage con
    // cualquier archivo nuevo, sin que el developer decida explícitamente que
    // la corrección está lista — esa transición pide su propia acción.
    if (stage?.state === "Pending") {
      await transitionStage({
        stageId: stage.id,
        to: "InProgress",
        actorUserId: req.user!.id,
        auditAction: "STAGE_WORK_INITIATED"
      });
    }

    return res.status(201).json(evidence);
  }
);

export default router;
