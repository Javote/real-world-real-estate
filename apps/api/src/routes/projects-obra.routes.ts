import {
  cuidParamSchema,
  evidenceBundleSummarySchema,
  onChainEventSchema,
  stageEventSummarySchema,
  stageEvidenceSummarySchema,
  stageSchema,
  stageWithThreadSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import type { UserRole } from "../db/types";
import { reconciliarParaLectura } from "../domain/reconcile";
import { retryStageMint } from "../domain/stage-transition";
import { db } from "../lib/db";
import { OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { ANY_MEMBERSHIP, authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";

/** `GET /:id/stages/:stageId` compone el stage con evidencia, bundle y eventos. */
const stageDetailNestedSchema = stageSchema.extend({
  evidences: z.array(stageEvidenceSummarySchema),
  bundle: evidenceBundleSummarySchema.nullable(),
  hasOnChainThread: z.boolean(),
  events: z.array(stageEventSummarySchema)
});

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
// **Tres rutas se borraron de acá el 2026-09-08: `GET/POST /:id/evidence` y
// `POST /:id/stages`.** Las dos primeras eran CRUD genérico sin ningún
// caller real en el front (confirmado con `grep -rn "api.uploadEvidence"
// apps/web/src`, cero resultados) y sombra exacta de la ruta real
// (`POST /developer/projects/:id/stages/:stageId/evidence`, M2-D5 fila 38,
// que además devuelve Merkle root y TXID en la misma respuesta). La tercera
// —crear una etapa suelta— no tenía ninguna gemela, pero tampoco tenía
// caller real ni una sola línea en M1/M2/M3 que la pidiera: es más vieja que
// el Stage template de 10 (`git log` la ubica antes del catálogo, D-021),
// nadie repreguntó si seguía haciendo falta después de que el template
// existiera. Los tests que la usaban para tener un stage con hilo real
// migraron a `test/helpers/stages.ts` (`crearStageMinteado`), que hace lo
// mismo sin pasar por HTTP. Detalle completo en `CLAUDE.md` raíz.
//
// **SPEC-216 §E6 — migrado a oRPC (D-066)**, junto con `projects.routes.ts`
// (mismo prefijo, ver el comentario de ese archivo).

const PREFIJO_ABSOLUTO = "/api/v1/projects";

/** El contexto que cada procedimiento recibe — siempre el usuario ya
 * autenticado por `authenticate`, corrido antes de que oRPC vea la request. */
export type ProjectsObraContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<ProjectsObraContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));
router.param("stageId", paramValidator(cuidParamSchema));

router.use(authenticate);

const stagesOfProjectProcedure = os
  .route({ method: "GET", path: "/{id}/stages" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(stageWithThreadSchema))
  .handler(async ({ input }) => {
    const result = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", input.id)
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

    return z
      .array(stageWithThreadSchema)
      .parse(result.map((stage) => ({ ...stage, hasOnChainThread: conHilo.has(stage.id) })));
  });
const stagesOfProjectHandler = new OpenAPIHandler({ stagesOfProjectProcedure });

router.get(
  "/:id/stages",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res, next) => {
    const { matched } = await stagesOfProjectHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO
    });
    if (!matched) next();
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
 *
 * Los cuatro códigos de `retryStageMint` que un caso legítimo puede producir
 * son errores con nombre — el quinto (`STAGE_NOT_FOUND`) es defensivo: la
 * ruta ya confirmó que el stage pertenece al proyecto antes de llamar a
 * `retryStageMint`, así que en la práctica no se alcanza por esta puerta.
 */
const retryStageAnchorProcedure = orpc
  .errors({
    STAGE_ALREADY_ADVANCED: {
      status: 409,
      message: "Stage already advanced without a thread — no honest retroactive mint"
    },
    THREAD_ALREADY_OPEN: { status: 409, message: "Thread already open for this stage" },
    THREAD_ALREADY_ON_CHAIN: {
      status: 409,
      message: "The chain already has a live thread for this stage"
    },
    STAGE_CREATED_EVENT_NOT_FOUND: {
      status: 404,
      message: "No creation event to retry for this stage"
    }
  })
  .route({ method: "POST", path: "/{id}/stages/{stageId}/retry-anchor" })
  .input(z.strictObject({ id: cuidParamSchema, stageId: cuidParamSchema }))
  .output(stageSchema.extend({ anchor: onChainEventSchema }))
  .handler(async ({ input, context, errors }) => {
    const stage = await db
      .selectFrom("Stage")
      .select("id")
      .where("id", "=", input.stageId)
      .where("projectId", "=", input.id)
      .executeTakeFirst();

    if (!stage) throw new ORPCError("NOT_FOUND", { message: "Stage does not belong to project" });

    const result = await retryStageMint(input.stageId);
    if (!result.ok) {
      if (result.code === "STAGE_NOT_FOUND") {
        throw new ORPCError("NOT_FOUND", { message: "Stage not found" });
      }
      throw errors[result.code]({ message: result.code });
    }

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "RETRY_STAGE_ANCHOR",
      entityType: "Stage",
      entityId: result.stage.id
    });

    return stageSchema.extend({ anchor: onChainEventSchema }).parse({
      ...result.stage,
      anchor: result.anchor
    });
  });
const retryStageAnchorHandler = new OpenAPIHandler({ retryStageAnchorProcedure });

router.post(
  "/:id/stages/:stageId/retry-anchor",
  authorize({
    roles: ["admin"],
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res, next) => {
    const { matched } = await retryStageAnchorHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
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
const nestedStageDetailProcedure = os
  .route({ method: "GET", path: "/{id}/stages/{stageId}" })
  .input(z.strictObject({ id: cuidParamSchema, stageId: cuidParamSchema }))
  .output(stageDetailNestedSchema)
  .handler(async ({ input }) => {
    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", input.stageId)
      .where("projectId", "=", input.id)
      .executeTakeFirst();

    if (!stage) throw new ORPCError("NOT_FOUND", { message: "Stage not found" });

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

    return stageDetailNestedSchema.parse({
      ...stage,
      evidences,
      bundle: bundle ?? null,
      // Calculado, no guardado (evita una segunda fuente de verdad): el mismo
      // criterio que `cabezaDelHilo`, sin una query aparte porque `eventos` ya
      // trae `outputRef`.
      hasOnChainThread: eventos.some((e) => e.outputRef !== null),
      events: eventos
    });
  });
const nestedStageDetailHandler = new OpenAPIHandler({ nestedStageDetailProcedure });

router.get(
  "/:id/stages/:stageId",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res, next) => {
    const { matched } = await nestedStageDetailHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO
    });
    if (!matched) next();
  }
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 3
 * rutas migradas. */
export const projectsObraOrpcRouter = {
  stagesOfProjectProcedure,
  retryStageAnchorProcedure,
  nestedStageDetailProcedure
};

export default router;
