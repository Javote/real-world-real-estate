import {
  certifierAssignmentSchema,
  certifierCertificateSchema,
  certifierInvitationSchema,
  certifierKpisSchema,
  certifierStageViewSchema,
  cuidParamSchema,
  cursorPaginationSchema,
  observeStageSchema,
  onChainEventSchema,
  paginatedResponseSchema,
  stageSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { createId } from "../db/id.js";
import type { UserRole } from "../db/types.js";
import { listarInvitacionesACertificar } from "../domain/certifier-invitation.js";
import { reconciliarParaLectura } from "../domain/reconcile.js";
import { transitionStage, ultimoBundlePorStage } from "../domain/stage-transition.js";
import { db, enLote } from "../lib/db.js";
import { sql } from "../lib/kysely.js";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { paramValidator } from "../middlewares/validate-params.js";
import { proyectosVisibles } from "./_shared.js";

const PREFIJO_ABSOLUTO = "/api/v1/certifier";

export type CertifierContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<CertifierContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

const kpisProcedure = orpc
  .route({ method: "GET", path: "/kpis" })
  .output(certifierKpisSchema)
  .handler(async ({ context }) => {
    const ids = (await proyectosVisibles(context.user.id, context.user.role).execute()).map(
      (p) => p.id
    );

    const stages = ids.length
      ? await db.selectFrom("Stage").select(["state"]).where("projectId", "in", ids).execute()
      : [];

    return {
      assigned: stages.filter((s) => s.state === "InProgress").length,
      certified: stages.filter((s) => s.state === "Completed").length,
      observed: stages.filter((s) => s.state === "Observed").length,
      totalStages: stages.length
    };
  });
const kpisHandler = new OpenAPIHandler({ kpisProcedure });

router.get(
  "/kpis",
  authorize({
    roles: ["admin", "verifier"],
    acceso: { scopeEnQuery: "projectScope(cualquier membresía)" }
  }),
  delegarAOrpc(kpisHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const assignmentsProcedure = orpc
  .route({ method: "GET", path: "/assignments" })
  .output(z.array(certifierAssignmentSchema))
  .handler(async ({ context }) => {
    const ids = (await proyectosVisibles(context.user.id, context.user.role).execute()).map(
      (p) => p.id
    );

    if (ids.length === 0) return [];

    return db
      .selectFrom("Stage")
      .innerJoin("Project", "Project.id", "Stage.projectId")
      .select([
        "Stage.id as stageId",
        "Stage.name as stageName",
        "Stage.sequenceOrder as sequenceOrder",
        "Project.name as projectName"
      ])
      .where("Stage.projectId", "in", ids)
      .where("Stage.state", "in", ["InProgress", "Observed"])
      .orderBy("Stage.sequenceOrder", "asc")
      .execute();
  });
const assignmentsHandler = new OpenAPIHandler({ assignmentsProcedure });

router.get(
  "/assignments",
  authorize({
    roles: ["admin", "verifier"],
    acceso: { scopeEnQuery: "projectScope(cualquier membresía)" }
  }),
  delegarAOrpc(assignmentsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const stageViewProcedure = os
  .route({ method: "GET", path: "/stages/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(certifierStageViewSchema)
  .handler(async ({ input }) => {
    const stage = await db
      .selectFrom("Stage")
      .innerJoin("Project", "Project.id", "Stage.projectId")
      .select([
        "Stage.id as id",
        "Stage.name as name",
        "Stage.sequenceOrder as sequenceOrder",
        "Stage.state as state",
        "Stage.validationCritical as validationCritical",
        "Project.id as projectId",
        "Project.name as projectName"
      ])
      .where("Stage.id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Stage) */
    if (!stage) throw new ORPCError("NOT_FOUND", { message: "Stage not found" });

    const evidencia = await db
      .selectFrom("Evidence")
      .select(["id", "originalFilename", "category", "authoritative", "sha256Hash", "uploadedAt"])
      .where("stageId", "=", stage.id)
      .orderBy("uploadedAt", "desc")
      .execute();

    return { ...stage, evidence: evidencia };
  });
const stageViewHandler = new OpenAPIHandler({ stageViewProcedure });

router.get(
  "/stages/:id",
  authorize({
    roles: ["admin", "verifier"],
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ["verifier"] }
  }),
  delegarAOrpc(stageViewHandler, PREFIJO_ABSOLUTO)
);

function lanzarFalloDeTransicion(
  resultado: Extract<Awaited<ReturnType<typeof transitionStage>>, { ok: false }>
): never {
  /* v8 ignore if -- @preserve: el único 404 de transitionStage es un stage que authorize ya cargó */
  if (resultado.status === 404) throw new ORPCError("NOT_FOUND", { message: "Stage not found" });
  throw new ORPCError("CONFLICT", { message: resultado.code, data: resultado });
}

const certifyProcedure = orpc
  .route({ method: "POST", path: "/stages/{id}/certify", successStatus: 201 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(stageSchema.extend({ anchor: onChainEventSchema }))
  .handler(async ({ input, context }) => {
    const resultado = await transitionStage({
      stageId: input.id,
      to: "Completed",
      actorUserId: context.user.id,
      auditAction: "CERTIFY_STAGE"
    });

    if (!resultado.ok) lanzarFalloDeTransicion(resultado);

    return { ...resultado.stage, anchor: resultado.anchor };
  });
const certifyHandler = new OpenAPIHandler({ certifyProcedure });

router.post(
  "/stages/:id/certify",
  authorize({
    roles: ["admin", "verifier"],
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ["verifier"] }
  }),
  delegarAOrpc(certifyHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const observeProcedure = orpc
  .route({ method: "POST", path: "/stages/{id}/observe", successStatus: 201 })
  .input(observeStageSchema.extend({ id: cuidParamSchema }))
  .output(stageSchema.extend({ anchor: onChainEventSchema }))
  .handler(async ({ input, context }) => {
    const resultado = await transitionStage({
      stageId: input.id,
      to: "Observed",
      actorUserId: context.user.id,
      note: input.note,
      auditAction: "OBSERVE_STAGE"
    });

    if (!resultado.ok) lanzarFalloDeTransicion(resultado);

    return { ...resultado.stage, anchor: resultado.anchor };
  });
const observeHandler = new OpenAPIHandler({ observeProcedure });

router.post(
  "/stages/:id/observe",
  authorize({
    roles: ["admin", "verifier"],
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ["verifier"] }
  }),
  delegarAOrpc(observeHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const certificatesProcedure = orpc
  .route({ method: "GET", path: "/certificates" })
  .input(cursorPaginationSchema)
  .output(paginatedResponseSchema(certifierCertificateSchema))
  .handler(async ({ input, context }) => {
    const visibles = (await proyectosVisibles(context.user.id, context.user.role).execute()).map(
      (p) => p.id
    );
    if (visibles.length) await reconciliarParaLectura({ projectIds: visibles });

    let query = db
      .selectFrom("Stage")
      .innerJoin("Project", "Project.id", "Stage.projectId")
      .leftJoin(ultimoBundlePorStage, "EvidenceBundle.stageId", "Stage.id")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.stageId", "=", "Stage.id")
          .on("OnChainEvent.eventType", "=", "STAGE_TRANSITION")
          .on("OnChainEvent.toState", "=", "Completed")
      )
      .select([
        "Stage.id as stageId",
        "Stage.name as stageName",
        "Stage.certifiedAt as certifiedAt",
        "Project.name as projectName",
        "EvidenceBundle.commitmentHash as commitmentHash",
        "OnChainEvent.txid as txid",
        "OnChainEvent.status as anchorStatus"
      ])
      .where("Stage.state", "=", "Completed")
      .where("Stage.certifiedById", "=", context.user.id)
      .orderBy("Stage.certifiedAt", "desc")
      .limit(input.limit);

    if (input.cursor) {
      query = query.where("Stage.certifiedAt", "<", new Date(input.cursor));
    }

    const filas = await query.execute();
    const ultima = filas.at(-1);

    return {
      items: filas,
      nextCursor: ultima?.certifiedAt ? new Date(ultima.certifiedAt).toISOString() : null
    };
  });
const certificatesHandler = new OpenAPIHandler({ certificatesProcedure });

router.get(
  "/certificates",
  authorize({
    roles: ["admin", "verifier"],
    acceso: { scopeEnQuery: "Stage.certifiedById = usuario" }
  }),
  delegarAOrpc(certificatesHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const myInvitationsProcedure = orpc
  .route({ method: "GET", path: "/invitations" })
  .output(z.array(certifierInvitationSchema))
  .handler(async ({ context }) =>
    listarInvitacionesACertificar({ certifierId: context.user.id, soloPendientes: true })
  );
const myInvitationsHandler = new OpenAPIHandler({ myInvitationsProcedure });

router.get(
  "/invitations",
  authorize({
    roles: ["admin", "verifier"],
    acceso: { scopeEnQuery: "CertifierInvitation.certifierId = usuario" }
  }),
  delegarAOrpc(myInvitationsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

function responderInvitacion(respuesta: "accepted" | "declined") {
  return orpc
    .errors({ INVITATION_NOT_PENDING: { status: 409 } })
    .input(z.strictObject({ id: cuidParamSchema }))
    .output(certifierInvitationSchema)
    .handler(async ({ input, context, errors }) => {
      const ahora = new Date();

      // Un solo lote: el UPDATE reclama la invitación, el audit entra solo si la reclamó (`changes()` es
      // el de la sentencia anterior) y el miembro, solo si ese audit existe. Sin transacción interactiva
      // (SPEC-618): dos respuestas a la vez dan un ganador y un 409, nunca un `SQLITE_BUSY`.
      const auditId = createId();
      const [reclamada] = await enLote(
        db
          .updateTable("CertifierInvitation")
          .set({ status: respuesta, respondedAt: ahora })
          .where("id", "=", input.id)
          .where("status", "=", "pending")
          .returning("id"),
        db
          .insertInto("AuditLog")
          .columns([
            "id",
            "actorUserId",
            "action",
            "entityType",
            "entityId",
            "metadataJson",
            "createdAt"
          ])
          .expression(
            db
              .selectNoFrom((eb) => [
                eb.val(auditId).as("id"),
                eb.val(context.user.id).as("actorUserId"),
                eb
                  .val(
                    respuesta === "accepted"
                      ? "ACCEPT_CERTIFIER_INVITATION"
                      : "DECLINE_CERTIFIER_INVITATION"
                  )
                  .as("action"),
                eb.val("CertifierInvitation").as("entityType"),
                eb.val(input.id).as("entityId"),
                eb
                  .val(
                    JSON.stringify(respuesta === "accepted" ? { membershipRole: "verifier" } : {})
                  )
                  .as("metadataJson"),
                eb.val(ahora).as("createdAt")
              ])
              .where(sql<number>`changes()`, "=", 1)
          ),
        ...(respuesta === "accepted"
          ? [
              db
                .insertInto("ProjectMember")
                .columns(["id", "userId", "projectId", "membershipRole", "createdAt"])
                .expression(
                  db
                    .selectFrom("CertifierInvitation")
                    .select((eb) => [
                      eb.val(createId()).as("id"),
                      "certifierId",
                      "projectId",
                      eb.val("verifier").as("membershipRole"),
                      eb.val(ahora).as("createdAt")
                    ])
                    .where("id", "=", input.id)
                    .where((eb) =>
                      eb.exists(db.selectFrom("AuditLog").select("id").where("id", "=", auditId))
                    )
                )
                .onConflict((oc) => oc.doNothing())
            ]
          : [])
      );

      if (reclamada.length === 0) {
        const fila = await db
          .selectFrom("CertifierInvitation")
          .select("status")
          .where("id", "=", input.id)
          .executeTakeFirst();
        /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (CertifierInvitation) */
        if (!fila) throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
        throw errors.INVITATION_NOT_PENDING({ message: `Invitation already ${fila.status}` });
      }
      const [resultado] = await listarInvitacionesACertificar({ id: input.id });
      return resultado!;
    });
}

const acceptInvitationProcedure = responderInvitacion("accepted").route({
  method: "POST",
  path: "/invitations/{id}/accept"
});
const declineInvitationProcedure = responderInvitacion("declined").route({
  method: "POST",
  path: "/invitations/{id}/decline"
});
const acceptInvitationHandler = new OpenAPIHandler({ acceptInvitationProcedure });
const declineInvitationHandler = new OpenAPIHandler({ declineInvitationProcedure });

for (const [accion, handler] of [
  ["accept", acceptInvitationHandler],
  ["decline", declineInvitationHandler]
] as const) {
  router.post(
    `/invitations/:id/${accion}`,
    authorize({
      roles: ["admin", "verifier"],
      acceso: { dueño: { via: "CertifierInvitation", param: "id" } }
    }),
    delegarAOrpc(handler, PREFIJO_ABSOLUTO, conUsuario)
  );
}

export const certifierOrpcRouter = {
  kpisProcedure,
  assignmentsProcedure,
  stageViewProcedure,
  certifyProcedure,
  observeProcedure,
  certificatesProcedure,
  myInvitationsProcedure,
  acceptInvitationProcedure,
  declineInvitationProcedure
};

export default router;
