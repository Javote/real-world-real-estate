import {
  cuidParamSchema,
  evidenceSchema,
  onChainEventSchema,
  projectSchema,
  stageSchema,
  stageTransitionSchema,
  updateStageSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import type { UserRole } from "../db/types";
import { cabezaDelHilo, transitionStage } from "../domain/stage-transition";
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { ANY_MEMBERSHIP, authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared";

// **SPEC-216 §E5 — migrado a oRPC (D-066).** Concentra cuatro de los seis
// `.errors()` con nombre que el lote necesita (`STAGE_IDENTITY_IMMUTABLE`,
// `STAGE_TRANSITION_FORBIDDEN`, `STAGE_TRANSITION_INVALID`,
// `STAGE_EVIDENCE_REQUIRED`, `STAGE_EVIDENCE_UNATTRIBUTED` — cinco, no
// cuatro: la auditoría de la spec las contó en la misma fila porque
// comparten procedimiento) — todos ya resueltos en producción por §A-D de
// SPEC-212 (mismo mecanismo que `DOSSIER_SIGNED` en `notary.routes.ts`).
//
// **`transitionStage` sigue siendo la única lógica de dominio**: la ruta
// solo aporta su autorización y traduce el `TransitionResult` a un
// `ORPCError` con nombre en vez de a un `res.status(...).json(...)` a mano.

/**
 * `GET /:id` compone el stage con su evidencia y su proyecto — describe
 * exactamente esa forma, ni más ni menos (regla 5).
 */
const stageDetailSchema = stageSchema.extend({
  evidences: z.array(evidenceSchema),
  project: projectSchema,
  hasOnChainThread: z.boolean()
});

const PREFIJO_ABSOLUTO = "/api/v1/stages";

/** El contexto que cada procedimiento recibe — siempre el usuario ya
 * autenticado por `authenticate`, corrido antes de que oRPC vea la request. */
export type StagesContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<StagesContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

const stageDetailProcedure = os
  .route({ method: "GET", path: "/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(stageDetailSchema)
  .handler(async ({ input }) => {
    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto: { via: "Stage" } }) ya cargó el stage (SPEC-018) */
    if (!stage) throw new ORPCError("NOT_FOUND", { message: "Stage not found" });

    // EVIDENCE_SAFE_COLUMNS, no selectAll(): esta ruta devolvía storagePath
    // —la ruta absoluta en disco del servidor— sobre cada evidencia del stage
    // (D-011). Encontrado escribiendo su schema de respuesta (Tanda 2).
    const [evidences, project, hilo] = await Promise.all([
      db
        .selectFrom("Evidence")
        .select(EVIDENCE_SAFE_COLUMNS)
        .where("stageId", "=", stage.id)
        .execute(),
      db.selectFrom("Project").selectAll().where("id", "=", stage.projectId).executeTakeFirst(),
      cabezaDelHilo(stage.id)
    ]);

    return stageDetailSchema.parse({
      ...stage,
      evidences,
      project,
      hasOnChainThread: hilo !== null
    });
  });
const stageDetailHandler = new OpenAPIHandler({ stageDetailProcedure });

router.get(
  "/:id",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  delegarAOrpc(stageDetailHandler, PREFIJO_ABSOLUTO)
);

/**
 * `sequenceOrder` y `validationCritical` son parte de la IDENTIDAD del
 * stage en el datum, y el validador exige que no cambie nunca
 * (`identity_preserved`). Con el hilo ya anclado, reescribirlas acá dejaría
 * a la base diciendo una cosa y a la cadena otra, sin forma de reconciliar.
 *
 * **`cabezaDelHilo`, no "cualquier OnChainEvent con txid"**: un stage puede
 * tener evidencia anclada por metadata (`EVIDENCE_ANCHOR`) sin tener hilo
 * — ese anclaje no toca el validador ni la identidad del stage (D-006). Un
 * chequeo más ancho bloquearía cambios de orden/criticidad sobre un stage
 * que nunca minteó nada.
 */
const updateStageProcedure = orpc
  .errors({
    STAGE_IDENTITY_IMMUTABLE: { status: 409, message: "Stage identity is immutable once anchored" }
  })
  .route({ method: "PATCH", path: "/{id}" })
  .input(updateStageSchema.extend({ id: cuidParamSchema }))
  .output(stageSchema)
  .handler(async ({ input, context, errors }) => {
    const { id, ...body } = input;

    const stageExisting = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto: { via: "Stage" } }) ya cargó el stage (SPEC-018) */
    if (!stageExisting) throw new ORPCError("NOT_FOUND", { message: "Stage not found" });

    const tocaIdentidad = body.sequenceOrder !== undefined || body.validationCritical !== undefined;

    if (tocaIdentidad && (await cabezaDelHilo(id)) !== null) {
      throw errors.STAGE_IDENTITY_IMMUTABLE({
        message: "Stage identity is immutable once anchored"
      });
    }

    const stage = await db
      .updateTable("Stage")
      .set({ ...body, updatedAt: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "UPDATE_STAGE",
      entityType: "Stage",
      entityId: stage.id
    });

    return stageSchema.parse(stage);
  });
const updateStageHandler = new OpenAPIHandler({ updateStageProcedure });

router.patch(
  "/:id",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(updateStageHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * M2-D1 §Role Permission Matrix: "Stage certification" y "Stage
 * observation" son acciones exclusivas del certifier — esta ruta es la
 * del developer, y `authorize` de arriba solo garantiza rol+membresía, no
 * CUÁL transición. `transitionStage` valida que la FSM lo permita, no
 * quién la pide, así que sin este chequeo un developer podía
 * auto-certificar su propio stage vía esta misma ruta. `admin` no tiene
 * este límite (regla del bypass ya establecida en `projectScope`).
 *
 * Toda la lógica —tabla de transiciones, evidencia, bundle, anclaje, audit
 * log— vive en el dominio: esta ruta solo aporta su autorización y traduce
 * el resultado a HTTP.
 */
const transitionStageProcedure = orpc
  .errors({
    STAGE_TRANSITION_FORBIDDEN: {
      status: 403,
      message: "Only a certifier can move a stage to Completed or Observed"
    },
    STAGE_TRANSITION_INVALID: { status: 409, message: "Invalid stage transition" },
    STAGE_EVIDENCE_REQUIRED: {
      status: 409,
      message: "A validation-critical stage cannot be completed without evidence"
    },
    STAGE_EVIDENCE_UNATTRIBUTED: {
      status: 409,
      message: "A validation-critical stage cannot be completed without evidence"
    }
  })
  .route({ method: "PATCH", path: "/{id}/state" })
  .input(stageTransitionSchema.extend({ id: cuidParamSchema }))
  .output(stageSchema.extend({ anchor: onChainEventSchema }))
  .handler(async ({ input, context, errors }) => {
    if (context.user.role !== "admin" && input.state !== "InProgress") {
      throw errors.STAGE_TRANSITION_FORBIDDEN({
        message: "Only a certifier can move a stage to Completed or Observed"
      });
    }

    const resultado = await transitionStage({
      stageId: input.id,
      to: input.state,
      actorUserId: context.user.id
    });

    if (!resultado.ok) {
      /* v8 ignore if -- @preserve: authorize({ proyecto: { via: "Stage" } }) ya cargó el stage (SPEC-018) */
      if (resultado.status === 404)
        throw new ORPCError("NOT_FOUND", { message: "Stage not found" });
      if (resultado.code === "STAGE_TRANSITION_INVALID") {
        throw errors.STAGE_TRANSITION_INVALID({
          message: `Invalid stage transition: ${resultado.from} → ${resultado.to}`
        });
      }
      if (resultado.code === "STAGE_EVIDENCE_REQUIRED") {
        throw errors.STAGE_EVIDENCE_REQUIRED({
          message: "A validation-critical stage cannot be completed without evidence"
        });
      }
      throw errors.STAGE_EVIDENCE_UNATTRIBUTED({
        message: "A validation-critical stage cannot be completed without evidence"
      });
    }

    return stageSchema.extend({ anchor: onChainEventSchema }).parse({
      ...resultado.stage,
      anchor: resultado.anchor
    });
  });
const transitionStageHandler = new OpenAPIHandler({ transitionStageProcedure });

router.patch(
  "/:id/state",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(transitionStageHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 3
 * rutas migradas. */
export const stagesOrpcRouter = {
  stageDetailProcedure,
  updateStageProcedure,
  transitionStageProcedure
};

export default router;
