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

const stageDetailSchema = stageSchema.extend({
  evidences: z.array(evidenceSchema),
  project: projectSchema,
  hasOnChainThread: z.boolean()
});

const PREFIJO_ABSOLUTO = "/api/v1/stages";

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

    /* v8 ignore if -- @preserve: authorize({ proyecto: { via: "Stage" } }) ya cargó el stage */
    if (!stage) throw new ORPCError("NOT_FOUND", { message: "Stage not found" });

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

    /* v8 ignore if -- @preserve: authorize({ proyecto: { via: "Stage" } }) ya cargó el stage */
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
      /* v8 ignore if -- @preserve: authorize({ proyecto: { via: "Stage" } }) ya cargó el stage */
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

export const stagesOrpcRouter = {
  stageDetailProcedure,
  updateStageProcedure,
  transitionStageProcedure
};

export default router;
