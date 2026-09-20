import {
  certifierAssignmentSchema,
  certifierCertificateSchema,
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
import type { UserRole } from "../db/types";
import { reconciliarParaLectura } from "../domain/reconcile";
import { transitionStage, ultimoBundlePorStage } from "../domain/stage-transition";
import { db } from "../lib/db";
import { OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { authenticate, authorize } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { proyectosVisibles } from "./_shared";

// Superficie del certifier (M2-D5 filas 56v, 56c, 57, 58).
//
// **SPEC-212 §B — migrado a oRPC (D-066), la segunda sub-parte.** Mismo
// patrón que §A (`notary.routes.ts`, ya cerrado): el schema de cada ruta se
// declara una sola vez en su procedimiento, `authorize` no se toca — sigue
// siendo middleware Express delante de oRPC, ruta por ruta — y el `prefix`
// de cada `OpenAPIHandler.handle()` es el path ABSOLUTO (`PREFIJO_ABSOLUTO`),
// nunca un fragmento relativo: oRPC lee `req.originalUrl`, que Express no
// reescribe al entrar a este sub-router. Ver `notary.routes.ts` y SPEC-212
// para el porqué completo de cada una de estas decisiones — acá no se
// repiten.
//
// **Certificar y observar son transiciones de la misma FSM**, con distinta
// autorización: las dos delegan en `transitionStage`. Si esta ruta escribiera su
// propia versión, la tabla de transiciones existiría dos veces.
//
// **Ningún test llama a `/stages/:id/certify` ni `/stages/:id/observe` por
// HTTP** (las 16 transiciones de la FSM se ejercitan contra
// `PATCH /stages/:id/state`, con token admin — ver `apps/api/CLAUDE.md`,
// entrada del 2026-08-24). Los 404/409 de `transitionStage` acá no tienen
// body fijado por ningún test, así que `ORPCError` liso alcanza para los
// dos — a diferencia del 409 `DOSSIER_SIGNED` de §A, que sí lo tenía.
//
// Y una precisión de vocabulario que el entregable obliga (D-026): el certifier
// **no certifica validez legal**. Verifica integridad y completitud contra los
// hashes anclados. El endpoint se llama `certify` porque así lo nombra M2-D5;
// lo que hace es cerrar el stage y anclar la prueba.

const PREFIJO_ABSOLUTO = "/api/v1/certifier";

/** Exportado para que `scripts/generate-openapi.ts` tipe el
 * `os.prefix(...).router(...)` combinado — mismo motivo que `NotaryContext`
 * en `notary.routes.ts`. */
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

    // "Asignado" es, por ahora, un stage en curso dentro de un proyecto donde
    // este usuario es miembro con rol verifier. El modelo de asignación
    // explícita todavía no existe.
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
  async (req, res, next) => {
    const { matched } = await kpisHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
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
  async (req, res, next) => {
    const { matched } = await assignmentsHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** Fila 56v — la vista de certificación: el stage con su evidencia. */
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

    if (!stage) throw new ORPCError("NOT_FOUND", { message: "Stage not found" });

    const evidencia = await db
      .selectFrom("Evidence")
      .select(["id", "originalFilename", "category", "authoritative", "sha256Hash", "uploadedAt"])
      .where("stageId", "=", stage.id)
      .orderBy("uploadedAt", "desc")
      .execute();

    // El empty-state de la fila 56v es parte del diseño, no un caso de error:
    // un stage sin evidencia se ve, y por eso la lista viaja vacía en vez de
    // 404.
    return { ...stage, evidence: evidencia };
  });
const stageViewHandler = new OpenAPIHandler({ stageViewProcedure });

router.get(
  "/stages/:id",
  authorize({
    roles: ["admin", "verifier"],
    acceso: { proyecto: { via: "Stage", param: "id" }, membresias: ["verifier"] }
  }),
  async (req, res, next) => {
    const { matched } = await stageViewHandler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
    if (!matched) next();
  }
);

/**
 * Traduce un `TransitionResult` de fallo al error de oRPC — usado por
 * `certify` y `observe`, las dos únicas rutas que llaman a `transitionStage`.
 * Ningún test fija el body de estos 404/409 (ver el comentario de arriba del
 * archivo), así que `ORPCError` liso es la adaptación correcta.
 */
function lanzarFalloDeTransicion(
  resultado: Extract<Awaited<ReturnType<typeof transitionStage>>, { ok: false }>
): never {
  if (resultado.status === 404) throw new ORPCError("NOT_FOUND", { message: "Stage not found" });
  throw new ORPCError("CONFLICT", { message: resultado.code, data: resultado });
}

/** Fila 56c — certificar: cierra el stage y ancla su bundle. */
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
  async (req, res, next) => {
    const { matched } = await certifyHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** Fila 57 — observar: devuelve el stage al developer con una nota. */
const observeProcedure = orpc
  .route({ method: "POST", path: "/stages/{id}/observe", successStatus: 201 })
  .input(observeStageSchema.extend({ id: cuidParamSchema }))
  .output(stageSchema.extend({ anchor: onChainEventSchema }))
  .handler(async ({ input, context }) => {
    // **La observación va al `AuditLog`, no al datum.** On-chain solo van
    // commitments y refs opacas (regla 2): el texto de una observación es
    // contenido, y además puede nombrar personas.
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
  async (req, res, next) => {
    const { matched } = await observeHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** Fila 58 — historial de lo emitido, con su hash y su TXID. */
const certificatesProcedure = orpc
  .route({ method: "GET", path: "/certificates" })
  .input(cursorPaginationSchema)
  .output(paginatedResponseSchema(certifierCertificateSchema))
  .handler(async ({ input, context }) => {
    // **Reconciliar antes de consultar** (D-077): esta respuesta lleva
    // `anchorStatus`, y sin esto un anclaje que ya está en un bloque se sirve
    // como `Pending` para siempre. El alcance son los proyectos que este
    // certifier ve — sus certificaciones no pueden estar en otro lado. La
    // regla vive en `reconcile.ts`: toda lectura que devuelva el estado de un
    // anclaje reconcilia su propio alcance primero, y la fija
    // `test/reconcile-on-read.test.ts`.
    const visibles = (await proyectosVisibles(context.user.id, context.user.role).execute()).map(
      (p) => p.id
    );
    if (visibles.length) await reconciliarParaLectura({ projectIds: visibles });

    // `ultimoBundlePorStage` (SPEC-213) elige el bundle vigente — un stage
    // acumula uno por cada subida de evidencia antes de completarse, así que
    // un `leftJoin` directo a `EvidenceBundle` duplicaría filas de este
    // listado.
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

    // Paginación por cursor (M2-D5 pide `?cursor=` en las tres superficies de
    // historial): el cursor es el `certifiedAt` de la última fila devuelta.
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
  async (req, res, next) => {
    const { matched } = await certificatesHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 6
 * rutas migradas, aparte del documento manual de las que no migraron. */
export const certifierOrpcRouter = {
  kpisProcedure,
  assignmentsProcedure,
  stageViewProcedure,
  certifyProcedure,
  observeProcedure,
  certificatesProcedure
};

export default router;
