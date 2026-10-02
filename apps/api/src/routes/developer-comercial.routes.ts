import {
  createInvitationSchema,
  createUnitSchema,
  cuidParamSchema,
  developerContractSchema,
  developerUnitDirectoryEntrySchema,
  type InvitationStatus,
  invitationSchema,
  paymentAttestationSchema,
  paymentReleaseResultSchema,
  positiveIntParamSchema,
  RELEASE_EXCEEDS_CONTRACT,
  releasePaymentSchema,
  type UnitStatus,
  unitSchema,
  updateUnitSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import type { UserRole } from "../db/types";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { notify } from "../domain/notify";
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize, projectScope } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { relanzarRestriccionComoOrpc } from "./_shared";

const PREFIJO_ABSOLUTO = "/api/v1/developer";

type DeveloperContext = { user: { id: string; role: UserRole } };
const orpc = os.$context<DeveloperContext>();

class ReleaseExceedsContractError extends Error {
  constructor(
    readonly totalMinorUnits: number,
    readonly releasedMinorUnits: number
  ) {
    super("Release would exceed the contract total");
    this.name = "ReleaseExceedsContractError";
  }
}

const router = Router();

router.param("id", paramValidator(cuidParamSchema));
router.param("stageNum", paramValidator(positiveIntParamSchema));

router.use(authenticate);

const unitsOfProjectProcedure = os
  .route({ method: "GET", path: "/projects/{id}/units" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(unitSchema))
  .handler(async ({ input }) => {
    const unidades = await db
      .selectFrom("Unit")
      .selectAll()
      .where("projectId", "=", input.id)
      .orderBy("unitReference", "asc")
      .execute();

    return unidades.map((u) => ({ ...u, status: u.status as UnitStatus }));
  });
const unitsOfProjectHandler = new OpenAPIHandler({ unitsOfProjectProcedure });

router.get(
  "/projects/:id/units",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(unitsOfProjectHandler, PREFIJO_ABSOLUTO)
);

const createUnitProcedure = orpc
  .errors({
    RESOURCE_ALREADY_EXISTS: { status: 409, message: "Resource already exists" },
    RELATED_RESOURCE_NOT_FOUND: { status: 400, message: "A referenced resource does not exist" }
  })
  .route({ method: "POST", path: "/projects/{id}/units", successStatus: 201 })
  .input(createUnitSchema.extend({ id: cuidParamSchema }))
  .output(unitSchema)
  .handler(async ({ input, context, errors }) => {
    const ahora = new Date();
    const unidad = await db
      .insertInto("Unit")
      .values({
        id: createId(),
        projectId: input.id,
        unitReference: input.unitReference,
        status: "available",
        floor: input.floor ?? null,
        sizeM2: input.sizeM2 ?? null,
        priceMinorUnits: input.priceMinorUnits ?? null,
        currency: input.currency ?? null,
        investorId: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .returningAll()
      .executeTakeFirstOrThrow()
      .catch((err) => relanzarRestriccionComoOrpc(err, errors));

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "CREATE_UNIT",
      entityType: "Unit",
      entityId: unidad.id
    });

    return { ...unidad, status: unidad.status as UnitStatus };
  });
const createUnitHandler = new OpenAPIHandler({ createUnitProcedure });

router.post(
  "/projects/:id/units",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(createUnitHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const updateUnitProcedure = orpc
  .route({ method: "PATCH", path: "/units/{id}" })
  .input(updateUnitSchema.extend({ id: cuidParamSchema }))
  .output(unitSchema)
  .handler(async ({ input, context }) => {
    const { id, ...cambios } = input;

    const unidad = await db.selectFrom("Unit").selectAll().where("id", "=", id).executeTakeFirst();
    /* v8 ignore if -- @preserve: authorize({ proyecto: { via: "Unit" } }) ya cargó la unidad */
    if (!unidad) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    const actualizada = await db
      .updateTable("Unit")
      .set({ ...cambios, updatedAt: new Date() })
      .where("id", "=", unidad.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "UPDATE_UNIT",
      entityType: "Unit",
      entityId: unidad.id
    });

    return { ...actualizada, status: actualizada.status as UnitStatus };
  });
const updateUnitHandler = new OpenAPIHandler({ updateUnitProcedure });

router.patch(
  "/units/:id",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { via: "Unit", param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(updateUnitHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const unitsProcedure = orpc
  .route({ method: "GET", path: "/units" })
  .output(z.array(developerUnitDirectoryEntrySchema))
  .handler(async ({ context }) => {
    const proyectos = await db
      .selectFrom("Project")
      .select("id")
      .where((eb) => projectScope(eb, context.user.role, context.user.id, ["developer"]))
      .execute();

    const ids = proyectos.map((p) => p.id);
    if (ids.length === 0) return [];

    const unidades = await db
      .selectFrom("Unit")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .select([
        "Unit.id as id",
        "Unit.unitReference as unitReference",
        "Unit.status as status",
        "Unit.priceMinorUnits as priceMinorUnits",
        "Unit.currency as currency",
        "Unit.investorId as investorId",
        "Project.id as projectId",
        "Project.name as projectName"
      ])
      .where("Unit.projectId", "in", ids)
      .execute();

    return unidades.map((u) => ({ ...u, status: u.status as UnitStatus }));
  });
const unitsHandler = new OpenAPIHandler({ unitsProcedure });

router.get(
  "/units",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  delegarAOrpc(unitsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const createInvitationProcedure = orpc
  .errors({ UNIT_NOT_AVAILABLE: { status: 409 } })
  .route({ method: "POST", path: "/projects/{id}/invitations", successStatus: 201 })
  .input(createInvitationSchema.extend({ id: cuidParamSchema }))
  .output(invitationSchema)
  .handler(async ({ input, context, errors }) => {
    const unidad = await db
      .selectFrom("Unit")
      .selectAll()
      .where("id", "=", input.unitId)
      .where("projectId", "=", input.id)
      .executeTakeFirst();

    if (!unidad) throw new ORPCError("BAD_REQUEST", { message: "Unit does not belong to project" });

    if (unidad.status !== "available") {
      throw errors.UNIT_NOT_AVAILABLE({ message: `Unit is ${unidad.status}, not available` });
    }

    const ahora = new Date();
    const invitacion = await db
      .insertInto("Invitation")
      .values({
        id: createId(),
        projectId: input.id,
        unitId: unidad.id,
        investorEmail: input.investorEmail,
        amountMinorUnits: input.amountMinorUnits,
        currency: input.currency,
        status: "pending",
        createdById: context.user.id,
        createdAt: ahora,
        respondedAt: null
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await db
      .updateTable("Unit")
      .set({ status: "reserved", updatedAt: ahora })
      .where("id", "=", unidad.id)
      .execute();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "CREATE_INVITATION",
      entityType: "Invitation",
      entityId: invitacion.id
    });

    const invitado = await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", input.investorEmail)
      .executeTakeFirst();
    if (invitado) {
      await notify({
        userId: invitado.id,
        category: "stage",
        titleKey: "notifications.invitation.received",
        params: { invitationId: invitacion.id }
      });
    }

    return { ...invitacion, status: invitacion.status as InvitationStatus };
  });
const createInvitationHandler = new OpenAPIHandler({ createInvitationProcedure });

router.post(
  "/projects/:id/invitations",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(createInvitationHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const contractsOfProjectProcedure = os
  .route({ method: "GET", path: "/projects/{id}/contracts" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(developerContractSchema))
  .handler(async ({ input }) => {
    const contratos = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .innerJoin("User", "User.id", "Contract.investorId")
      .select([
        "Contract.id as id",
        "Contract.totalMinorUnits as totalMinorUnits",
        "Contract.currency as currency",
        "Contract.signedAt as signedAt",
        "Unit.id as unitId",
        "Unit.unitReference as unitReference",
        "Unit.status as unitStatus",
        "User.fullName as investorName",
        "User.email as investorEmail"
      ])
      .where("Unit.projectId", "=", input.id)
      .execute();

    const unitIds = [...new Set(contratos.map((c) => c.unitId))];

    const anclajes = unitIds.length
      ? await db
          .selectFrom("Invitation")
          .innerJoin("OnChainEvent", (join) =>
            join
              .onRef("OnChainEvent.referenceId", "=", "Invitation.id")
              .on("OnChainEvent.eventType", "=", "INVITATION_ACCEPTED")
          )
          .select([
            "Invitation.unitId as unitId",
            "Invitation.investorEmail as investorEmail",
            "Invitation.respondedAt as respondedAt",
            "OnChainEvent.txid as txid",
            "OnChainEvent.commitment as commitment"
          ])
          .where("Invitation.unitId", "in", unitIds)
          .where("Invitation.status", "=", "accepted")
          .execute()
      : [];

    return contratos.map(({ investorEmail, ...contrato }) => {
      const candidatos = anclajes.filter(
        (a) => a.unitId === contrato.unitId && a.investorEmail === investorEmail
      );

      const firmado = contrato.signedAt;
      const anclaje = candidatos.reduce<(typeof candidatos)[number] | null>((mejor, a) => {
        if (mejor === null) return a;
        if (firmado === null) return mejor;
        const distancia = (c: (typeof candidatos)[number]) => {
          const respondido = c.respondedAt;
          return respondido === null ? Number.POSITIVE_INFINITY : Math.abs(respondido - firmado);
        };
        return distancia(a) < distancia(mejor) ? a : mejor;
      }, null);

      return {
        ...contrato,
        unitStatus: contrato.unitStatus as UnitStatus,
        txid: anclaje?.txid ?? null,
        commitment: anclaje?.commitment ?? null
      };
    });
  });
const contractsOfProjectHandler = new OpenAPIHandler({ contractsOfProjectProcedure });

router.get(
  "/projects/:id/contracts",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(contractsOfProjectHandler, PREFIJO_ABSOLUTO)
);

const releasePaymentProcedure = orpc
  .errors({
    STAGE_NOT_CERTIFIED: { status: 409 },
    [RELEASE_EXCEEDS_CONTRACT]: { status: 409 }
  })
  .route({
    method: "POST",
    path: "/contracts/{id}/releases/{stageNum}",
    outputStructure: "detailed"
  })
  .input(releasePaymentSchema.extend({ id: cuidParamSchema, stageNum: positiveIntParamSchema }))
  .output(
    z.union([
      z.strictObject({ status: z.literal(200), body: paymentAttestationSchema }),
      z.strictObject({ status: z.literal(201), body: paymentReleaseResultSchema })
    ])
  )
  .handler(async ({ input, context, errors }) => {
    const stageNumber = input.stageNum;

    const contrato = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select([
        "Contract.id as id",
        "Contract.unitId as unitId",
        "Contract.currency as currency",
        "Contract.totalMinorUnits as totalMinorUnits",
        "Unit.projectId as projectId"
      ])
      .where("Contract.id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto: { via: "Contract" } }) ya cargó el contrato, con el mismo join a Unit */
    if (!contrato) throw new ORPCError("NOT_FOUND", { message: "Contract not found" });

    const stage = await db
      .selectFrom("Stage")
      .select(["id", "state"])
      .where("projectId", "=", contrato.projectId)
      .where("sequenceOrder", "=", stageNumber)
      .executeTakeFirst();

    if (!stage) throw new ORPCError("NOT_FOUND", { message: "Stage not found" });
    if (stage.state !== "Completed") {
      throw errors.STAGE_NOT_CERTIFIED({ message: "Stage is not certified yet" });
    }

    const ahora = new Date();

    const resultado = await db
      .transaction()
      .execute(async (trx) => {
        const previa = await trx
          .selectFrom("PaymentAttestation")
          .selectAll()
          .where("contractId", "=", contrato.id)
          .where("stageNumber", "=", stageNumber)
          .executeTakeFirst();

        if (previa) return { fila: previa, yaExistia: true as const };

        const liberado = await trx
          .selectFrom("PaymentAttestation")
          .select((eb) => eb.fn.sum<number>("amountMinorUnits").as("total"))
          .where("contractId", "=", contrato.id)
          .executeTakeFirst();

        const liberadoHastaAhora = Number(liberado?.total ?? 0);
        if (liberadoHastaAhora + input.amountMinorUnits > contrato.totalMinorUnits) {
          throw new ReleaseExceedsContractError(contrato.totalMinorUnits, liberadoHastaAhora);
        }

        const fila = await trx
          .insertInto("PaymentAttestation")
          .values({
            id: createId(),
            contractId: contrato.id,
            stageNumber,
            amountMinorUnits: input.amountMinorUnits,
            releasedById: context.user.id,
            releasedAt: ahora
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return { fila, yaExistia: false as const };
      })
      .catch((err) => {
        if (err instanceof ReleaseExceedsContractError) {
          throw errors[RELEASE_EXCEEDS_CONTRACT]({
            message: "Release would exceed the contract total"
          });
        }
        throw err;
      });

    const { fila: release, yaExistia } = resultado;

    if (yaExistia) return { status: 200 as const, body: release };

    const anchor = await anchorCommitmentEvent({
      projectId: contrato.projectId,
      eventType: "PAYMENT_RELEASE",
      commitment: commitmentOf({
        contractId: contrato.id,
        stageNumber,
        amountMinorUnits: input.amountMinorUnits,
        releasedAt: ahora.toISOString()
      }),
      reference: release.id,
      stageId: stage.id
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "RELEASE_PAYMENT",
      entityType: "PaymentAttestation",
      entityId: release.id,
      metadata: { stageNumber, txid: anchor.txid }
    });

    return { status: 201 as const, body: { ...release, anchor } };
  });
const releasePaymentHandler = new OpenAPIHandler({ releasePaymentProcedure });

router.post(
  "/contracts/:id/releases/:stageNum",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { via: "Contract", param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(releasePaymentHandler, PREFIJO_ABSOLUTO, conUsuario)
);

export const developerComercialOrpcRouter = {
  unitsOfProjectProcedure,
  createUnitProcedure,
  updateUnitProcedure,
  unitsProcedure,
  createInvitationProcedure,
  contractsOfProjectProcedure,
  releasePaymentProcedure
};

export default router;
