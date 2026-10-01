import {
  cuidParamSchema,
  cursorPaginationSchema,
  dossierRejectResultSchema,
  dossierSchema,
  dossierSignResultSchema,
  notaryKpisSchema,
  notarySignatureSchema,
  paginatedResponseSchema,
  pendingDossierSchema,
  rejectDossierSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import type { UserRole } from "../db/types";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { compileDossier } from "../domain/dossier";
import { notifyUnitInvestor } from "../domain/notify";
import { reconciliarParaLectura } from "../domain/reconcile";
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";

const PREFIJO_ABSOLUTO = "/api/v1/notary";

export type NotaryContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<NotaryContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

const kpisProcedure = orpc
  .route({ method: "GET", path: "/kpis" })
  .output(notaryKpisSchema)
  .handler(({ context }) => {
    return db
      .selectFrom("Dossier")
      .select(["id", "status", "signedById", "unitId"])
      .execute()
      .then((filas) => {
        const firmados = filas.filter(
          (f) =>
            f.status === "signed" &&
            (context.user.role === "admin" || f.signedById === context.user.id)
        );
        const pendientes = filas.filter((f) => f.status === "compiled");

        return {
          pendingDossiers: pendientes.length,
          verified: filas.filter((f) => f.status !== "compiled").length,
          signed: firmados.length,
          unitsUnderReview: new Set(pendientes.map((f) => f.unitId)).size
        };
      });
  });
const kpisHandler = new OpenAPIHandler({ kpisProcedure });

router.get(
  "/kpis",
  authorize({
    roles: ["admin", "notary"],
    acceso: { scopeEnQuery: "Dossier.signedById = usuario" }
  }),
  delegarAOrpc(kpisHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const pendingDossiersProcedure = os
  .route({ method: "GET", path: "/dossiers/pending" })
  .output(z.array(pendingDossierSchema))
  .handler(async () => {
    const filas = await db
      .selectFrom("Dossier")
      .innerJoin("Unit", "Unit.id", "Dossier.unitId")
      .leftJoin("User", "User.id", "Unit.investorId")
      .select([
        "Dossier.id as dossierId",
        "Dossier.unitId as unitId",
        "Unit.unitReference as unitReference",
        "User.fullName as investorName"
      ])
      .where("Dossier.status", "=", "compiled")
      .orderBy("Dossier.compiledAt", "asc")
      .limit(50)
      .execute();

    const pendientes: z.infer<typeof pendingDossierSchema>[] = [];
    for (const fila of filas) {
      const dossier = await compileDossier(fila.unitId);
      pendientes.push({
        dossierId: fila.dossierId,
        unitLabel: fila.unitReference,
        /* v8 ignore start -- @preserve: un Dossier solo se compila para una unidad con investor */
        investorName: fila.investorName ?? fila.unitReference,
        /* v8 ignore stop -- @preserve */
        /* v8 ignore start -- @preserve: un Dossier solo se compila para una unidad con investor */
        completeness: dossier?.completeness ?? 0
        /* v8 ignore stop -- @preserve */
      });
    }

    return pendientes;
  });
const pendingDossiersHandler = new OpenAPIHandler({ pendingDossiersProcedure });

// El escribano no tiene membresía por proyecto: la cola de dossiers es compartida.
router.get(
  "/dossiers/pending",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  delegarAOrpc(pendingDossiersHandler, PREFIJO_ABSOLUTO)
);

const dossierByIdProcedure = os
  .route({ method: "GET", path: "/dossiers/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(dossierSchema)
  .handler(async ({ input }) => {
    const fila = await db
      .selectFrom("Dossier")
      .select("unitId")
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!fila) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    const dossier = await compileDossier(fila.unitId);
    /* v8 ignore if -- @preserve: FK Dossier.unitId → Unit.id es ON DELETE CASCADE */
    if (!dossier) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    const { investorId: _investorId, ...publico } = dossier;
    return publico;
  });
const dossierByIdHandler = new OpenAPIHandler({ dossierByIdProcedure });

router.get(
  "/dossiers/:id",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  delegarAOrpc(dossierByIdHandler, PREFIJO_ABSOLUTO)
);

async function firmaExistente(dossierId: string, masterHash: string) {
  await reconciliarParaLectura({ referenceId: dossierId });

  const anterior = await db
    .selectFrom("OnChainEvent")
    .selectAll()
    .where("referenceId", "=", dossierId)
    .where("eventType", "=", "DOSSIER_SIGNATURE")
    .executeTakeFirst();

  return {
    status: 200 as const,
    body: { dossierId, masterHash, anchor: anterior ?? undefined }
  };
}

const signDossierProcedure = orpc
  .errors({
    DOSSIER_NOT_SIGNABLE: { status: 409, message: "Dossier is not awaiting signature" }
  })
  .route({
    method: "POST",
    path: "/dossiers/{id}/sign",
    outputStructure: "detailed",
    successStatus: 201
  })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(
    z.union([
      z.strictObject({ status: z.literal(200), body: dossierSignResultSchema }),
      z.strictObject({ status: z.literal(201), body: dossierSignResultSchema })
    ])
  )
  .handler(async ({ input, context, errors }) => {
    const fila = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!fila) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    if (fila.status === "signed") return firmaExistente(fila.id, fila.masterHash);

    const dossier = await compileDossier(fila.unitId);
    /* v8 ignore if -- @preserve: FK Dossier.unitId → Unit.id es ON DELETE CASCADE */
    if (!dossier) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    const ahora = new Date();

    // Reclamar antes de anclar: solo quien gana este UPDATE ancla la firma.
    const reclamado = await db
      .updateTable("Dossier")
      .set({
        status: "signed",
        masterHash: dossier.masterHash,
        signedById: context.user.id,
        signedAt: ahora,
        rejectionNote: null
      })
      .where("id", "=", fila.id)
      .where("status", "=", "compiled")
      .returning("id")
      .executeTakeFirst();

    if (!reclamado) {
      const actual = await db
        .selectFrom("Dossier")
        .select(["status", "masterHash"])
        .where("id", "=", fila.id)
        .executeTakeFirstOrThrow();
      if (actual.status === "signed") return firmaExistente(fila.id, actual.masterHash);
      throw errors.DOSSIER_NOT_SIGNABLE();
    }

    const anchor = await anchorCommitmentEvent({
      projectId: dossier.projectId,
      eventType: "DOSSIER_SIGNATURE",
      commitment: commitmentOf({
        dossierId: dossier.id,
        masterHash: dossier.masterHash,
        signedAt: ahora.toISOString()
      }),
      reference: dossier.id
    });

    await notifyUnitInvestor({
      unitId: dossier.unitId,
      category: "signature",
      titleKey: "notifications.dossier.signed",
      params: { unitReference: dossier.unitReference }
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "SIGN_DOSSIER",
      entityType: "Dossier",
      entityId: dossier.id,
      metadata: { masterHash: dossier.masterHash, txid: anchor.txid }
    });

    return {
      status: 201,
      body: { dossierId: dossier.id, masterHash: dossier.masterHash, signedAt: ahora, anchor }
    };
  });
const signDossierHandler = new OpenAPIHandler({ signDossierProcedure });

router.post(
  "/dossiers/:id/sign",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  delegarAOrpc(signDossierHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const rejectDossierProcedure = orpc
  .errors({
    DOSSIER_SIGNED: { status: 409, message: "Dossier already signed" },
    DOSSIER_NOT_REJECTABLE: { status: 409, message: "Dossier is not awaiting review" }
  })
  .route({ method: "POST", path: "/dossiers/{id}/reject" })
  .input(rejectDossierSchema.extend({ id: cuidParamSchema }))
  .output(dossierRejectResultSchema)
  .handler(async ({ input, context, errors }) => {
    const fila = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!fila) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    const rechazado = await db
      .updateTable("Dossier")
      .set({ status: "rejected", rejectionNote: input.note })
      .where("id", "=", fila.id)
      .where("status", "=", "compiled")
      .returning("id")
      .executeTakeFirst();

    if (!rechazado) {
      const actual = await db
        .selectFrom("Dossier")
        .select("status")
        .where("id", "=", fila.id)
        .executeTakeFirstOrThrow();
      if (actual.status === "signed") {
        throw errors.DOSSIER_SIGNED({ message: "Dossier already signed" });
      }
      throw errors.DOSSIER_NOT_REJECTABLE();
    }

    await notifyUnitInvestor({
      unitId: fila.unitId,
      category: "signature",
      titleKey: "notifications.dossier.rejected"
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "REJECT_DOSSIER",
      entityType: "Dossier",
      entityId: fila.id,
      metadata: { note: input.note }
    });

    return { dossierId: fila.id, status: "rejected" as const };
  });
const rejectDossierHandler = new OpenAPIHandler({ rejectDossierProcedure });

router.post(
  "/dossiers/:id/reject",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  delegarAOrpc(rejectDossierHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const signaturesProcedure = orpc
  .route({ method: "GET", path: "/signatures" })
  .input(cursorPaginationSchema)
  .output(paginatedResponseSchema(notarySignatureSchema))
  .handler(async ({ input, context }) => {
    let query = db
      .selectFrom("Dossier")
      .innerJoin("Unit", "Unit.id", "Dossier.unitId")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.referenceId", "=", "Dossier.id")
          .on("OnChainEvent.eventType", "=", "DOSSIER_SIGNATURE")
      )
      .select([
        "Dossier.id as dossierId",
        "Dossier.masterHash as masterHash",
        "Dossier.status as status",
        "Dossier.signedAt as signedAt",
        "Unit.unitReference as unitReference",
        "Project.name as projectName",
        "OnChainEvent.txid as signatureTxid"
      ])
      .where("Dossier.status", "=", "signed")
      .orderBy("Dossier.signedAt", "desc")
      .limit(input.limit);

    if (context.user.role !== "admin") {
      query = query.where("Dossier.signedById", "=", context.user.id);
    }
    if (input.cursor) {
      query = query.where("Dossier.signedAt", "<", new Date(input.cursor).getTime());
    }

    const filas = await query.execute();
    const items = filas.map((f) => ({
      dossierId: f.dossierId,
      unitReference: f.unitReference,
      projectName: f.projectName,
      masterHash: f.masterHash,
      signatureTxid: f.signatureTxid,
      /* v8 ignore start -- @preserve: la query filtra status = "signed", y firmar siempre escribe signedAt */
      signedAt: f.signedAt ? new Date(f.signedAt) : null,
      /* v8 ignore stop -- @preserve */
      status: "signed" as const
    }));

    const ultima = items.at(-1);

    return {
      items,
      nextCursor: ultima?.signedAt ? ultima.signedAt.toISOString() : null
    };
  });
const signaturesHandler = new OpenAPIHandler({ signaturesProcedure });

router.get(
  "/signatures",
  authorize({
    roles: ["admin", "notary"],
    acceso: { scopeEnQuery: "Dossier.signedById = usuario" }
  }),
  delegarAOrpc(signaturesHandler, PREFIJO_ABSOLUTO, conUsuario)
);

export const notaryOrpcRouter = {
  kpisProcedure,
  pendingDossiersProcedure,
  dossierByIdProcedure,
  signDossierProcedure,
  rejectDossierProcedure,
  signaturesProcedure
};

export default router;
