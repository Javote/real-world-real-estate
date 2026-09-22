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
import { db } from "../lib/db";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize, projectScope } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { relanzarRestriccionComoOrpc } from "./_shared";

// **El ciclo comercial del developer**, bajo `/api/v1/developer` (M2-D5 filas
// 39, 40-41, 44, 44b).
//
// Unidad → invitación → contrato → liberación es UNA secuencia, y por eso vive
// junta: cada paso produce el estado que el siguiente consume. Separarla por
// entidad —una ruta de unidades, otra de invitaciones, otra de contratos—
// esconde que el orden importa.
//
// Segundo router sobre el mismo prefijo que `developer.routes.ts`, igual que
// `capital.routes.ts`: los paths son disjuntos y ninguno tiene catch-all, así
// que no se pisan (SPEC-015 §4 y §6).
//
// **Nada de esto mueve valor** (D-021): "liberar" significa anclar el evento de
// liberación, no ejecutar un pago.
//
// **SPEC-212 §D — migrado a oRPC (D-066).** Mismo patrón que el resto del
// prefijo: `authorize` sigue siendo middleware Express y hay un
// `OpenAPIHandler` por procedimiento, montado en el path exacto de esa ruta.
//
// **`UNIT_NOT_AVAILABLE` es un error CON NOMBRE** (`.errors({...})`), mismo
// criterio que `investor.routes.ts` §accept: `res.body.code` tiene que seguir
// siendo `"UNIT_NOT_AVAILABLE"` al nivel que ya fija
// `test/accept-invitation-atomic.test.ts` — un `ORPCError("CONFLICT", ...)`
// liso lo anidaría en `data.code`.
//
// **`RESOURCE_ALREADY_EXISTS` en `POST /projects/:id/units` es la misma
// trampa que ya se encontró en `developer.routes.ts`:** `OpenAPIHandler`
// nunca llama a `next(err)`, así que un `SQLITE_CONSTRAINT_UNIQUE` sin
// capturar (`Unit_projectId_unitReference_key`) se volvía el 500 genérico de
// oRPC en vez del 409 que `test/constraint-errors.test.ts` fija — ver
// `relanzarRestriccionComoOrpc` en `_shared.ts`.

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

/** Fila 44b — las unidades de un proyecto, del lado del developer. */
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
    if (!unidad) throw new ORPCError("NOT_FOUND", { message: "Unit not found" });

    const actualizada = await db
      .updateTable("Unit")
      .set({ ...cambios, updatedAt: new Date() })
      .where("id", "=", unidad.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Regla 7: editar una unidad es una mutación relevante — cambia el precio,
    // la superficie o el estado comercial de algo que después se invita y se
    // contrata. El alta ya lo escribía; la edición se había quedado sin él.
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

/** Fila 44 — el inventario cross-proyecto del developer. */
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

/**
 * Fila 39 — el developer emite la invitación.
 *
 * SPEC-201, invariante 1: una unidad `sold` no admite invitaciones nuevas.
 * Antes de este chequeo se podía emitir una segunda invitación `pending`
 * sobre una unidad que otra invitación ya había vendido, y esa segunda
 * invitación quedaba viva esperando un `accept` que terminaba sacándole la
 * unidad a quien ya la había comprado.
 */
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

    // La unidad queda reservada mientras la invitación esté pendiente.
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

/**
 * Fila 40-41 — los contratos de un proyecto, del lado del developer.
 *
 * **El contrato como REGISTRO, no como flujo de pagos** (D-070): lo que sale de
 * acá es quién acordó qué sobre qué unidad, en qué estado quedó la unidad y con
 * qué anclaje se registró el acuerdo. No hay etapas liberadas ni montos por
 * etapa, porque la plataforma no administra fondos.
 *
 * `unitStatus` está porque D-070 lo nombra explícitamente como lo que esta
 * superficie SÍ puede mostrar; el anclaje, porque es la única de las cuatro
 * afirmaciones de D-026 que aplica a un contrato: *se registró en este momento*.
 *
 * El anclaje se alcanza por la invitación y no por el contrato: quien ancla es
 * `POST /investor/invitations/:id/accept`, y el `referenceId` del evento es la
 * invitación. Por eso el join pasa por ahí — el contrato no guarda la ref.
 */
const contractsOfProjectProcedure = os
  .route({ method: "GET", path: "/projects/{id}/contracts" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(developerContractSchema))
  .handler(async ({ input }) => {
    // Los dos `innerJoin` son contra la clave primaria, así que esta consulta
    // devuelve exactamente un registro por contrato. El anclaje se busca aparte
    // —ver abajo— justamente para que no pueda multiplicar filas.
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

    // **Segunda consulta y no un `leftJoin`, y no es estilo: un join acá
    // MULTIPLICA.** Una unidad puede acumular más de una invitación aceptada
    // —el PATCH de unidad la devuelve a `available` y se re-invita—, y
    // `OnChainEvent` no tiene índice único por `referenceId`: el único que hay
    // es `(stageId, eventIndex)`, y en un evento de invitación `stageId` es
    // NULL, que en SQLite no restringe nada. Cada par de más devolvía el mismo
    // contrato repetido, con el anclaje de OTRO investor pegado al lado, y la
    // lista mentía sin fallar.
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
      // La invitación se ata al contrato por unidad **y por investor**: es el
      // email de la invitación contra el del `User` del contrato. Sin eso,
      // dos ventas de la misma unidad se cruzan los anclajes.
      const candidatos = anclajes.filter(
        (a) => a.unitId === contrato.unitId && a.investorEmail === investorEmail
      );

      // Si el mismo investor compró la misma unidad dos veces quedan varios:
      // gana el `respondedAt` más cercano al `signedAt`. Hoy son el MISMO
      // instante —el accept usa un único `ahora` para los dos— así que el
      // match es exacto; el criterio es lo que lo mantiene determinístico si
      // alguna vez dejan de serlo.
      //
      // SPEC-208 (B-10): las dos columnas ya son epoch ms de verdad — el
      // tipo dejó de mentir, así que el `new Date(x).getTime()` que las
      // envolvía "por las dudas" ya no hace falta.
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

/**
 * Fila 40-41 — liberar una etapa. **Ancla** (M3-SC-03).
 *
 * **Idempotente** (regla 8): el índice único (contrato, etapa) impide
 * liberar dos veces la misma — por eso el status de éxito no es fijo:
 * `outputStructure: "detailed"` deja que el handler elija 200 (ya existía) o
 * 201 (recién se liberó), cada uno con su propio schema de cuerpo.
 */
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

    if (!contrato) throw new ORPCError("NOT_FOUND", { message: "Contract not found" });

    // **La liberación exige que la etapa esté certificada.** El entregable lo
    // dice: "the developer initiates [the release] after the certifier has
    // issued the stage's certificate". Liberar antes sería afirmar un avance
    // que nadie verificó.
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

    // SPEC-205 (B-07) — nada comparaba la suma de `PaymentAttestation` contra
    // `Contract.totalMinorUnits`: un release de cualquier monto entraba, se
    // registraba y **se ancla su commitment en Cardano**. La plataforma no
    // custodia plata (D-021), pero sí vende el registro, y un registro que
    // admite una afirmación falsa —"se liberó más de lo contratado"— es
    // exactamente lo que este proyecto existe para evitar.
    //
    // El chequeo y el INSERT van en la misma transacción (mismo patrón que
    // SPEC-201 en `investor.routes.ts` §accept): sin esto, dos releases
    // concurrentes sobre el mismo contrato leen las dos la suma vieja y
    // entran las dos, aunque juntas superen el total — la idempotencia por
    // `(contractId, stageNumber)` no alcanza porque acá el conflicto es
    // entre DOS etapas distintas del mismo contrato, no la misma etapa dos
    // veces.
    const resultado = await db
      .transaction()
      .execute(async (trx) => {
        // Idempotencia (regla 8): el índice único (contrato, etapa) impide
        // liberar dos veces la misma.
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

    // Ya existía (idempotencia, regla 8): se devuelve tal cual, sin volver a
    // anclar — un segundo anclaje sobre el mismo release sería un evento
    // fantasma.
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

/** El router oRPC combinado de esta vertical — ver el comentario homólogo en
 * `developer.routes.ts`. */
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
