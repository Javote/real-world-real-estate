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
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { ANY_MEMBERSHIP, authenticate, authorize, CUALQUIER_ROL } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";

const stageDetailNestedSchema = stageSchema.extend({
  evidences: z.array(stageEvidenceSummarySchema),
  bundle: evidenceBundleSummarySchema.nullable(),
  hasOnChainThread: z.boolean(),
  events: z.array(stageEventSummarySchema)
});

const PREFIJO_ABSOLUTO = "/api/v1/projects";

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
    const [result, hilos] = await Promise.all([
      db
        .selectFrom("Stage")
        .selectAll()
        .where("projectId", "=", input.id)
        .orderBy("sequenceOrder", "asc")
        .execute(),
      db
        .selectFrom("OnChainEvent")
        .select("stageId")
        .distinct()
        .where("stageId", "in", (eb) =>
          eb.selectFrom("Stage").select("Stage.id").where("Stage.projectId", "=", input.id)
        )
        .where("outputRef", "is not", null)
        .execute()
    ]);

    const conHilo = new Set(hilos.map((r) => r.stageId));

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
  delegarAOrpc(stagesOfProjectHandler, PREFIJO_ABSOLUTO)
);

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
      /* v8 ignore if -- @preserve: el handler confirmó el stage tres líneas antes */
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
  delegarAOrpc(retryStageAnchorHandler, PREFIJO_ABSOLUTO, conUsuario)
);

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

    await reconciliarParaLectura({ stageId: stage.id });

    const [evidences, bundle, eventos] = await Promise.all([
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
  delegarAOrpc(nestedStageDetailHandler, PREFIJO_ABSOLUTO)
);

export const projectsObraOrpcRouter = {
  stagesOfProjectProcedure,
  retryStageAnchorProcedure,
  nestedStageDetailProcedure
};

export default router;
