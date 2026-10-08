import { randomBytes } from "node:crypto";
import type { InvitationStatus, NotificationCategory, UnitStatus } from "@plataforma/shared";
import {
  acceptInvitationResultSchema,
  cuidParamSchema,
  dossierSchema,
  dossierShareSchema,
  investorContractSchema,
  investorInvitationDetailSchema,
  investorUnitDetailSchema,
  investorUnitListItemSchema,
  notificationQuerySchema,
  notificationSchema,
  projectListItemSchema,
  unitNewsEventSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { createId } from "../db/id.js";
import type { UserRole } from "../db/types.js";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring.js";
import { compileDossier } from "../domain/dossier.js";
import { reconciliarParaLectura } from "../domain/reconcile.js";
import { ultimoBundlePorStage } from "../domain/stage-transition.js";
import { db, enLote } from "../lib/db.js";
import { sql } from "../lib/kysely.js";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { paramValidator } from "../middlewares/validate-params.js";
import { writeAuditLog } from "../utils/audit.js";
import { renderTextPdf } from "../utils/pdf.js";
import { avancePorProyecto, conStages } from "./_shared.js";

const PREFIJO_ABSOLUTO = "/api/v1/investor";

export type InvestorContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<InvestorContext>();

const router = Router();

async function dossierDeLaUnidad(unitId: string) {
  const dossier = await compileDossier(unitId);
  /* v8 ignore start -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) en las tres rutas que la llaman */
  return dossier ? { dossier } : { error: 404 as const };
  /* v8 ignore stop -- @preserve */
}

router.param("id", paramValidator(cuidParamSchema));
router.param("projectId", paramValidator(cuidParamSchema));
router.param("unitId", paramValidator(cuidParamSchema));

router.use(authenticate);

const favoritesProcedure = orpc
  .route({ method: "GET", path: "/favorites" })
  .output(z.array(projectListItemSchema))
  .handler(async ({ context }) =>
    conStages(
      await db
        .selectFrom("Favorite")
        .innerJoin("Project", "Project.id", "Favorite.projectId")
        .selectAll("Project")
        .where("Favorite.userId", "=", context.user.id)
        .orderBy("Favorite.createdAt", "desc")
        .execute()
    )
  );
const favoritesHandler = new OpenAPIHandler({ favoritesProcedure });

router.get(
  "/favorites",
  authorize({ roles: ["admin", "buyer"], acceso: { scopeEnQuery: "Favorite.userId = usuario" } }),
  delegarAOrpc(favoritesHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const addFavoriteProcedure = orpc
  .route({ method: "POST", path: "/favorites/{projectId}", successStatus: 204 })
  .input(z.strictObject({ projectId: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    const proyecto = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", input.projectId)
      .executeTakeFirst();

    if (!proyecto) throw new ORPCError("NOT_FOUND", { message: "Project not found" });

    await db
      .insertInto("Favorite")
      .values({ userId: context.user.id, projectId: proyecto.id, createdAt: new Date() })
      .onConflict((oc) => oc.columns(["userId", "projectId"]).doNothing())
      .execute();
  });
const addFavoriteHandler = new OpenAPIHandler({ addFavoriteProcedure });

router.post(
  "/favorites/:projectId",
  authorize({ roles: ["admin", "buyer"], acceso: "soloRol" }),
  delegarAOrpc(addFavoriteHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const removeFavoriteProcedure = orpc
  .route({ method: "DELETE", path: "/favorites/{projectId}", successStatus: 204 })
  .input(z.strictObject({ projectId: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    await db
      .deleteFrom("Favorite")
      .where("userId", "=", context.user.id)
      .where("projectId", "=", input.projectId)
      .execute();
  });
const removeFavoriteHandler = new OpenAPIHandler({ removeFavoriteProcedure });

router.delete(
  "/favorites/:projectId",
  authorize({ roles: ["admin", "buyer"], acceso: { scopeEnQuery: "Favorite.userId = usuario" } }),
  delegarAOrpc(removeFavoriteHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const unitsProcedure = orpc
  .route({ method: "GET", path: "/units" })
  .output(z.array(investorUnitListItemSchema))
  .handler(async ({ context }) => {
    const unidades = await db
      .selectFrom("Unit")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .select([
        "Unit.id as id",
        "Unit.unitReference as unitReference",
        "Unit.status as status",
        "Unit.sizeM2 as sizeM2",
        "Unit.priceMinorUnits as priceMinorUnits",
        "Unit.currency as currency",
        "Project.id as projectId",
        "Project.name as projectName",
        "Project.city as city",
        "Project.coverUpdatedAt as coverUpdatedAt"
      ])
      .where("Unit.investorId", "=", context.user.id)
      .execute();

    const avance = await avancePorProyecto([...new Set(unidades.map((u) => u.projectId))]);

    return unidades.map((u) => ({
      ...u,
      status: u.status as UnitStatus,
      /* v8 ignore start -- @preserve: avancePorProyecto setea un valor para cada id que recibe */
      progress: avance.get(u.projectId) ?? 0
      /* v8 ignore stop -- @preserve */
    }));
  });
const unitsHandler = new OpenAPIHandler({ unitsProcedure });

router.get(
  "/units",
  authorize({ roles: ["admin", "buyer"], acceso: { scopeEnQuery: "Unit.investorId = usuario" } }),
  delegarAOrpc(unitsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const unitDetailProcedure = os
  .route({ method: "GET", path: "/units/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(investorUnitDetailSchema)
  .handler(async ({ input }) => {
    const unidad = await db
      .selectFrom("Unit")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .select([
        "Unit.id as id",
        "Unit.unitReference as unitReference",
        "Unit.status as status",
        "Unit.sizeM2 as sizeM2",
        "Unit.floor as floor",
        "Unit.priceMinorUnits as priceMinorUnits",
        "Unit.currency as currency",
        "Unit.investorId as investorId",
        "Project.id as projectId",
        "Project.name as projectName",
        "Project.city as city",
        "Project.country as country"
      ])
      .where("Unit.id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) */
    if (!unidad) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    const stages = await db
      .selectFrom("Stage")
      .leftJoin(ultimoBundlePorStage, "EvidenceBundle.stageId", "Stage.id")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.stageId", "=", "Stage.id")
          .on("OnChainEvent.eventType", "=", "STAGE_TRANSITION")
          .on("OnChainEvent.toState", "=", "Completed")
      )
      .select([
        "Stage.id as stageId",
        "Stage.name as name",
        "Stage.sequenceOrder as sequenceOrder",
        "Stage.state as state",
        "EvidenceBundle.id as bundleId",
        "OnChainEvent.txid as txid"
      ])
      .where("Stage.projectId", "=", unidad.projectId)
      .orderBy("Stage.sequenceOrder", "asc")
      .execute();

    return { ...unidad, status: unidad.status as UnitStatus, stages };
  });
const unitDetailHandler = new OpenAPIHandler({ unitDetailProcedure });

router.get(
  "/units/:id",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(unitDetailHandler, PREFIJO_ABSOLUTO)
);

const unitNewsProcedure = os
  .route({ method: "GET", path: "/units/{id}/news" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(unitNewsEventSchema))
  .handler(async ({ input }) => {
    const unidad = await db
      .selectFrom("Unit")
      .select(["id", "projectId", "investorId"])
      .where("id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) */
    if (!unidad) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    await reconciliarParaLectura({ projectId: unidad.projectId });

    return db
      .selectFrom("OnChainEvent")
      .leftJoin("Stage", "Stage.id", "OnChainEvent.stageId")
      .select([
        "OnChainEvent.id as id",
        "OnChainEvent.eventType as eventType",
        "OnChainEvent.toState as toState",
        "OnChainEvent.txid as txid",
        "OnChainEvent.status as status",
        "OnChainEvent.createdAt as createdAt",
        "Stage.name as stageName"
      ])
      .where("OnChainEvent.projectId", "=", unidad.projectId)
      .orderBy("OnChainEvent.createdAt", "desc")
      .limit(50)
      .execute();
  });
const unitNewsHandler = new OpenAPIHandler({ unitNewsProcedure });

router.get(
  "/units/:id/news",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(unitNewsHandler, PREFIJO_ABSOLUTO)
);

const dossierProcedure = os
  .route({ method: "GET", path: "/units/{id}/dossier" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(dossierSchema)
  .handler(async ({ input }) => {
    const resultado = await dossierDeLaUnidad(input.id);
    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) */
    if (resultado.error === 404) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    const { investorId: _investorId, ...dossier } = resultado.dossier;
    return dossier;
  });
const dossierHandler = new OpenAPIHandler({ dossierProcedure });

router.get(
  "/units/:id/dossier",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(dossierHandler, PREFIJO_ABSOLUTO)
);

const dossierExportProcedure = orpc
  .route({ method: "GET", path: "/units/{id}/dossier/export.pdf", outputStructure: "detailed" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(
    z.object({ headers: z.record(z.string(), z.string()).optional(), body: z.instanceof(File) })
  )
  .handler(async ({ input, context }) => {
    const resultado = await dossierDeLaUnidad(input.id);
    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) */
    if (resultado.error === 404) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    const d = resultado.dossier;
    const pdf = renderTextPdf([
      "PropNexus - Proof dossier",
      "",
      `Project:      ${d.projectName}`,
      `Unit:         ${d.unitReference}`,
      `Compiled at:  ${d.compiledAt.toISOString()}`,
      `Status:       ${d.status}`,
      `Master hash:  ${d.masterHash}`,
      `Notary TXID:  ${d.signatureTxid ?? "(pending)"}`,
      `Completeness: ${d.completeness}% of artifacts have an on-chain reference`,
      "",
      "This document asserts only that these hashes were registered at these times,",
      "and, where a signature TXID is present, that a notary attested to reviewing them.",
      "It certifies nothing about the construction itself.",
      "",
      "Artifacts",
      "---------",
      ...d.artifacts.flatMap((a) => [
        `[${a.kind}] ${a.label}`,
        `  sha256: ${a.sha256 ?? "(none)"}`,
        `  txid:   ${a.txid ?? "(pending)"}`
      ])
    ]);

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "EXPORT_DOSSIER",
      entityType: "Dossier",
      entityId: d.id,
      metadata: { masterHash: d.masterHash }
    });

    const nombreArchivo = `dossier-${d.unitReference.replace(/[^\w.-]/g, "_")}.pdf`;
    return {
      headers: { "content-disposition": `attachment; filename="${nombreArchivo}"` },
      body: new File([Uint8Array.from(pdf)], nombreArchivo, { type: "application/pdf" })
    };
  });
const dossierExportHandler = new OpenAPIHandler({ dossierExportProcedure });

router.get(
  "/units/:id/dossier/export.pdf",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(dossierExportHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const shareDossierProcedure = orpc
  .route({ method: "POST", path: "/units/{id}/dossier/share", successStatus: 201 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(dossierShareSchema)
  .handler(async ({ input, context }) => {
    const resultado = await dossierDeLaUnidad(input.id);
    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Unit) */
    if (resultado.error === 404) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    const d = resultado.dossier;

    const fila = await db
      .selectFrom("Dossier")
      .select("shareToken")
      .where("id", "=", d.id)
      .executeTakeFirstOrThrow();

    let token = fila.shareToken;
    if (!token) {
      token = randomBytes(32).toString("hex");
      await db.updateTable("Dossier").set({ shareToken: token }).where("id", "=", d.id).execute();

      await writeAuditLog({
        actorUserId: context.user.id,
        action: "SHARE_DOSSIER",
        entityType: "Dossier",
        entityId: d.id
      });
    }

    return {
      shareToken: token,
      path: `/api/v1/public/dossier/${token}`,
      masterHash: d.masterHash
    };
  });
const shareDossierHandler = new OpenAPIHandler({ shareDossierProcedure });

router.post(
  "/units/:id/dossier/share",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  delegarAOrpc(shareDossierHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const notificationsProcedure = orpc
  .route({ method: "GET", path: "/notifications" })
  .input(notificationQuerySchema)
  .output(z.array(notificationSchema))
  .handler(async ({ input, context }) => {
    let query = db
      .selectFrom("Notification")
      .select(["id", "category", "titleKey", "paramsJson", "unitId", "readAt", "createdAt"])
      .where("userId", "=", context.user.id);

    if (input.unitId) query = query.where("unitId", "=", input.unitId);
    if (input.category) query = query.where("category", "=", input.category);

    const filas = await query.orderBy("createdAt", "desc").limit(100).execute();

    return filas.map((fila) => ({
      id: fila.id,
      category: fila.category as NotificationCategory,
      titleKey: fila.titleKey,
      params: fila.paramsJson ? JSON.parse(fila.paramsJson) : {},
      unitId: fila.unitId,
      readAt: fila.readAt,
      createdAt: fila.createdAt
    }));
  });
const notificationsHandler = new OpenAPIHandler({ notificationsProcedure });

router.get(
  "/notifications",
  authorize({
    roles: ["admin", "buyer"],
    acceso: { scopeEnQuery: "Notification.userId = usuario" }
  }),
  delegarAOrpc(notificationsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const invitationDetailProcedure = os
  .route({ method: "GET", path: "/invitations/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(investorInvitationDetailSchema)
  .handler(async ({ input }) => {
    const invitacion = await db
      .selectFrom("Invitation")
      .innerJoin("Unit", "Unit.id", "Invitation.unitId")
      .innerJoin("Project", "Project.id", "Invitation.projectId")
      .select([
        "Invitation.id as id",
        "Invitation.investorEmail as investorEmail",
        "Invitation.amountMinorUnits as amountMinorUnits",
        "Invitation.currency as currency",
        "Invitation.status as status",
        "Invitation.createdAt as createdAt",
        "Unit.unitReference as unitReference",
        "Project.name as projectName"
      ])
      .where("Invitation.id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Invitation) */
    if (!invitacion) throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });

    return { ...invitacion, status: invitacion.status as InvitationStatus };
  });
const invitationDetailHandler = new OpenAPIHandler({ invitationDetailProcedure });

router.get(
  "/invitations/:id",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Invitation", param: "id" } } }),
  delegarAOrpc(invitationDetailHandler, PREFIJO_ABSOLUTO)
);

const acceptInvitationProcedure = orpc
  .errors({
    INVITATION_NOT_PENDING: { status: 409 },
    UNIT_NOT_AVAILABLE: { status: 409 }
  })
  .route({ method: "POST", path: "/invitations/{id}/accept", successStatus: 201 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(acceptInvitationResultSchema)
  .handler(async ({ input, context, errors }) => {
    const ahora = new Date();

    // Un solo lote (SPEC-618): el UPDATE reclama la invitación solo si la unidad sigue disponible; el
    // contrato entra solo si lo reclamó (`changes()` es el de la sentencia anterior), y la venta de la
    // unidad, la membresía y el dossier, solo si ese contrato existe. Dos aceptaciones a la vez dan un
    // ganador.
    const contratoId = createId();
    const [[invitacion], contratos] = await enLote(
      db
        .updateTable("Invitation")
        .set({ status: "accepted", respondedAt: ahora })
        .where("id", "=", input.id)
        .where("status", "=", "pending")
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("Unit")
                .select("Unit.id")
                .whereRef("Unit.id", "=", "Invitation.unitId")
                .where("Unit.status", "=", "sold")
            )
          )
        )
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("Contract")
                .select("Contract.id")
                .whereRef("Contract.unitId", "=", "Invitation.unitId")
            )
          )
        )
        .returningAll(),
      db
        .insertInto("Contract")
        .columns([
          "id",
          "unitId",
          "investorId",
          "totalMinorUnits",
          "currency",
          "signedAt",
          "createdAt"
        ])
        .expression(
          db
            .selectFrom("Invitation")
            .select((eb) => [
              eb.val(contratoId).as("id"),
              "unitId",
              eb.val(context.user.id).as("investorId"),
              "amountMinorUnits",
              "currency",
              eb.val(ahora).as("signedAt"),
              eb.val(ahora).as("createdAt")
            ])
            .where("id", "=", input.id)
            .where(sql<number>`changes()`, "=", 1)
        )
        .returningAll(),
      db
        .updateTable("Unit")
        .set({ status: "sold", investorId: context.user.id, updatedAt: ahora })
        .where("id", "=", (eb) =>
          eb.selectFrom("Contract").select("Contract.unitId").where("Contract.id", "=", contratoId)
        ),
      db
        .insertInto("ProjectMember")
        .columns(["id", "userId", "projectId", "membershipRole", "createdAt"])
        .expression(
          db
            .selectFrom("Invitation")
            .select((eb) => [
              eb.val(createId()).as("id"),
              eb.val(context.user.id).as("userId"),
              "projectId",
              eb.val("buyer").as("membershipRole"),
              eb.val(ahora).as("createdAt")
            ])
            .where("id", "=", input.id)
            .where((eb) =>
              eb.exists(
                eb
                  .selectFrom("Contract")
                  .select("Contract.id")
                  .where("Contract.id", "=", contratoId)
              )
            )
        )
        .onConflict((oc) => oc.doNothing()),
      // El dossier nace con la venta (SPEC-615 decisión 2): las lecturas lo calculan y no escriben.
      // `masterHash` vacío hasta que el notary decida: es el hash que firmó o que rechazó.
      db
        .insertInto("Dossier")
        .columns(["id", "unitId", "masterHash", "compiledAt", "status"])
        .expression(
          db
            .selectFrom("Contract")
            .select((eb) => [
              eb.val(createId()).as("id"),
              "unitId",
              eb.val("").as("masterHash"),
              eb.val(ahora).as("compiledAt"),
              eb.val("compiled").as("status")
            ])
            .where("Contract.id", "=", contratoId)
        )
        .onConflict((oc) => oc.column("unitId").doNothing())
    );

    if (!invitacion) {
      const fila = await db
        .selectFrom("Invitation")
        .select("status")
        .where("id", "=", input.id)
        .executeTakeFirst();
      /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Invitation) */
      if (!fila) throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
      if (fila.status !== "pending") {
        throw errors.INVITATION_NOT_PENDING({ message: `Invitation already ${fila.status}` });
      }
      throw errors.UNIT_NOT_AVAILABLE({ message: "Unit is no longer available" });
    }
    // Con la invitación reclamada, el contrato entró en el mismo lote.
    const contrato = contratos[0]!;

    const anchor = await anchorCommitmentEvent({
      projectId: invitacion.projectId,
      eventType: "INVITATION_ACCEPTED",
      commitment: commitmentOf({
        invitationId: invitacion.id,
        unitId: invitacion.unitId,
        acceptedAt: ahora.toISOString()
      }),
      reference: invitacion.id
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "ACCEPT_INVITATION",
      entityType: "Invitation",
      entityId: invitacion.id,
      metadata: { txid: anchor.txid, membershipRole: "buyer" }
    });

    return { contract: contrato, anchor };
  });
const acceptInvitationHandler = new OpenAPIHandler({ acceptInvitationProcedure });

router.post(
  "/invitations/:id/accept",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Invitation", param: "id" } } }),
  delegarAOrpc(acceptInvitationHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const declineInvitationProcedure = orpc
  .route({ method: "POST", path: "/invitations/{id}/decline", successStatus: 204 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    const invitacion = await db
      .selectFrom("Invitation")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (Invitation) */
    if (!invitacion) throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
    if (invitacion.status !== "pending") {
      throw new ORPCError("CONFLICT", { message: `Invitation already ${invitacion.status}` });
    }

    const ahora = new Date();
    await db
      .updateTable("Invitation")
      .set({ status: "declined", respondedAt: ahora })
      .where("id", "=", invitacion.id)
      .execute();

    await db
      .updateTable("Unit")
      .set({ status: "available", updatedAt: ahora })
      .where("id", "=", invitacion.unitId)
      .execute();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "DECLINE_INVITATION",
      entityType: "Invitation",
      entityId: invitacion.id
    });
  });
const declineInvitationHandler = new OpenAPIHandler({ declineInvitationProcedure });

router.post(
  "/invitations/:id/decline",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Invitation", param: "id" } } }),
  delegarAOrpc(declineInvitationHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const contractProcedure = os
  .route({ method: "GET", path: "/contracts/{unitId}" })
  .input(z.strictObject({ unitId: cuidParamSchema }))
  .output(investorContractSchema)
  .handler(async ({ input }) => {
    const contrato = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select([
        "Contract.id as id",
        "Contract.totalMinorUnits as totalMinorUnits",
        "Contract.currency as currency",
        "Contract.signedAt as signedAt",
        "Contract.investorId as investorId",
        "Unit.unitReference as unitReference"
      ])
      .where("Contract.unitId", "=", input.unitId)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ dueño }) ya cargó la fila (ContractOfUnit) */
    if (!contrato) throw new ORPCError("NOT_FOUND", { message: "Contract not found" });

    return contrato;
  });
const contractHandler = new OpenAPIHandler({ contractProcedure });

router.get(
  "/contracts/:unitId",
  authorize({
    roles: ["admin", "buyer"],
    acceso: { dueño: { via: "ContractOfUnit", param: "unitId" } }
  }),
  delegarAOrpc(contractHandler, PREFIJO_ABSOLUTO)
);

export const investorOrpcRouter = {
  favoritesProcedure,
  addFavoriteProcedure,
  removeFavoriteProcedure,
  unitsProcedure,
  unitDetailProcedure,
  unitNewsProcedure,
  dossierProcedure,
  dossierExportProcedure,
  shareDossierProcedure,
  notificationsProcedure,
  invitationDetailProcedure,
  acceptInvitationProcedure,
  declineInvitationProcedure,
  contractProcedure
};

export default router;
