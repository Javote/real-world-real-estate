import { INITIAL_STAGE_STATE, stageTransitionSchema } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import {
  anchorEvent,
  recordOnChainEvent,
  tieneHiloAnclado,
  transitionStage
} from "../domain/stage-transition";
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
  "/projects/:id/stages",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const result = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", req.params.id)
      .orderBy("sequenceOrder", "asc")
      .execute();

    return res.json(result);
  }
);

router.post(
  "/projects/:id/stages",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.object({
      name: z.string().min(1),
      sequenceOrder: z.number().int().positive(),
      // `state` NO se acepta por body: todo stage nace en `Pending`. El
      // handler `mint` del validador lo exige para acuñar el hilo
      // (`valid_initial_datum`), así que dejar elegir el estado inicial acá
      // sería fabricar stages que no se pueden anclar.
      validationCritical: z.boolean().optional()
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

router.get(
  "/stages/:id",
  requireProjectAccess({ via: "Stage", param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!stage) {
      return res.status(404).json({ message: "Stage not found" });
    }

    const [evidences, project] = await Promise.all([
      db.selectFrom("Evidence").selectAll().where("stageId", "=", stage.id).execute(),
      db.selectFrom("Project").selectAll().where("id", "=", stage.projectId).executeTakeFirst()
    ]);

    return res.json({ ...stage, evidences, project });
  }
);

router.patch(
  "/stages/:id",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Stage", param: "id" }, ["developer"]),
  // `Request<{ id: string }>` porque en Express 5 `req.params.id` es
  // `string | string[]`, y `tieneHiloAnclado` necesita un id, no una lista.
  async (req: Request<{ id: string }>, res) => {
    const stageExisting = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!stageExisting) {
      return res.status(404).json({ message: "Stage not found" });
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      sequenceOrder: z.number().int().positive().optional(),
      validationCritical: z.boolean().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    // `sequenceOrder` y `validationCritical` son parte de la IDENTIDAD del
    // stage en el datum, y el validador exige que no cambie nunca
    // (`identity_preserved`). Con el hilo ya anclado, reescribirlas acá dejaría
    // a la base diciendo una cosa y a la cadena otra, sin forma de reconciliar.
    const tocaIdentidad =
      parsed.data.sequenceOrder !== undefined || parsed.data.validationCritical !== undefined;

    if (tocaIdentidad && (await tieneHiloAnclado(req.params.id))) {
      return res.status(409).json({
        message: "Stage identity is immutable once anchored",
        code: "STAGE_IDENTITY_IMMUTABLE"
      });
    }

    const stage = await db
      .updateTable("Stage")
      .set({ ...parsed.data, updatedAt: new Date() })
      .where("id", "=", req.params.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_STAGE",
      entityType: "Stage",
      entityId: stage.id
    });

    return res.json(stage);
  }
);

router.patch(
  "/stages/:id/state",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Stage", param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const parsed = stageTransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    // Toda la lógica —tabla de transiciones, evidencia, bundle, anclaje,
    // audit log— vive en el dominio: esta ruta solo aporta su autorización y
    // traduce el resultado a HTTP.
    const resultado = await transitionStage({
      stageId: req.params.id,
      to: parsed.data.state,
      actorUserId: req.user!.id
    });

    if (!resultado.ok) {
      if (resultado.status === 404) return res.status(404).json({ message: "Stage not found" });
      if (resultado.code === "STAGE_TRANSITION_INVALID") {
        return res.status(409).json({
          message: `Invalid stage transition: ${resultado.from} → ${resultado.to}`,
          code: resultado.code,
          from: resultado.from,
          to: resultado.to
        });
      }
      return res.status(409).json({
        message: "A validation-critical stage cannot be completed without evidence",
        code: resultado.code
      });
    }

    return res.json({ ...resultado.stage, anchor: resultado.anchor });
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
  "/projects/:id/stages/:stageId",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req: Request<{ id: string; stageId: string }>, res) => {
    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.stageId)
      .where("projectId", "=", req.params.id)
      .executeTakeFirst();

    if (!stage) return res.status(404).json({ message: "Stage not found" });

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
        .select(["eventType", "toState", "commitment", "txid", "status", "createdAt"])
        .where("stageId", "=", stage.id)
        .orderBy("eventIndex", "asc")
        .execute()
    ]);

    return res.json({ ...stage, evidences, bundle: bundle ?? null, events: eventos });
  }
);

export default router;
