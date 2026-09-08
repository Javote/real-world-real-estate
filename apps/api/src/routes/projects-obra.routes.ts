import { INITIAL_STAGE_STATE } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { reconciliarParaLectura } from "../domain/reconcile";
import { anchorEvent, recordOnChainEvent, retryStageMint } from "../domain/stage-transition";
import { db } from "../lib/db";
import { ANY_MEMBERSHIP, authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

// **El registro de obra de un proyecto**: sus stages (M2-D5 filas 08, 09-12).
//
// Segundo router sobre `/api/v1/projects`. Se separa de `projects.routes.ts`
// —que es el CRUD del proyecto y sus miembros— porque son dos cosas distintas
// con dos lectores distintos: el CRUD lo toca quien administra, esto lo lee
// quien quiere ver el avance y la prueba.
//
// **La FSM del stage no vive acá** (D-020): está en `packages/shared` y espejada
// en Aiken. Estas rutas la consumen vía `domain/stage-transition`.
//
// **La subida de evidencia se borró de acá el 2026-09-08.** `GET/POST
// /:id/evidence` eran CRUD genérico sin ningún caller real en el front —
// confirmado con `grep -rn "api.uploadEvidence" apps/web/src`, cero
// resultados — y la duplicación confundió una sesión entera (ver CLAUDE.md
// raíz). La subida real vive en `developer-evidencia.routes.ts`
// (`POST /developer/projects/:id/stages/:stageId/evidence`, M2-D5 fila 38),
// que además devuelve Merkle root y TXID en la misma respuesta, como pide
// M2-D5 §2.2. `POST /:id/stages` (crear una etapa suelta) sigue viva: no es
// una duplicación — no hay ninguna otra ruta que cree una sola etapa, y es
// la pieza base para el día que exista una UI de "agregar etapa".

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
      // (D-021). Nunca dinero — y opcional: el catálogo normativo
      // (DEFAULT_STAGE_CATALOG) no lo trae, el dueño prefirió no inventar un
      // reparto.
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

export default router;
