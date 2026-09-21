import {
  anchorDocumentSchema,
  auditLogEntrySchema,
  auditLogQuerySchema,
  createDeveloperProjectSchema,
  cuidParamSchema,
  DEFAULT_STAGE_CATALOG,
  developerDocumentListQuerySchema,
  developerDocumentSchema,
  developerKpisSchema,
  developerProgressItemSchema,
  developerProjectCreateResultSchema,
  developerProjectDetailSchema,
  developerProjectListItemSchema,
  INITIAL_STAGE_STATE,
  onChainEventSchema,
  paginatedResponseSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import type { OnChainEventRow, UserRole } from "../db/types";
import { anchorCommitmentEvent } from "../domain/anchoring";
import { agregadosDeProyectos } from "../domain/project-aggregates";
import { reconciliarParaLectura } from "../domain/reconcile";
import { anchorEvent, recordOnChainEvent } from "../domain/stage-transition";
import { db } from "../lib/db";
import { OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { auditScope, authenticate, authorize, projectScope } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { proyectosVisibles, relanzarRestriccionComoOrpc } from "./_shared";

// Superficie del developer (M2-D5 filas 34b-34c, 35-36, 37, 45, 46-47, 49).
//
// **Son los mismos datos que ya sirven las rutas genéricas, con la forma y el
// path que el backlog pide.** No es duplicación: `/projects` es CRUD nuestro y
// `/developer/projects` es una superficie del entregable, con su scope y su
// forma. El día que el CRUD genérico no le sirva a nadie, se borra.
//
// **SPEC-212 §D — migrado a oRPC (D-066), última de las cuatro sub-partes.**
// Mismo patrón que §A/§B/§C: `authorize` sigue siendo middleware Express,
// corriendo antes de que oRPC vea la request, y hay un `OpenAPIHandler` por
// procedimiento montado en el path exacto de esa ruta — nunca uno solo
// compartido en el prefijo del router, para que cada ruta conserve su propio
// `acceso`. El `prefix` de `.handle()` es el path ABSOLUTO
// (`PREFIJO_ABSOLUTO`), no el relativo dentro de este router: oRPC lee
// `req.originalUrl`, que Express nunca reescribe al entrar a un sub-router.
//
// **Este archivo comparte prefijo con otros tres** (`developer-comercial.
// routes.ts`, `developer-evidencia.routes.ts`, `capital.routes.ts`) — los
// cuatro montados en `/api/v1/developer` (`MONTAJE`, `app.ts`). Migrar una
// ruta acá no toca el `router.use(authenticate)` de los otros tres archivos,
// así que no hace falta migrarlos juntos.

const PREFIJO_ABSOLUTO = "/api/v1/developer";

export type DeveloperContext = { user: { id: string; role: UserRole } };
const orpc = os.$context<DeveloperContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

function misProyectos(userId: string, role: "admin" | "developer") {
  return db
    .selectFrom("Project")
    .selectAll("Project")
    .where((eb) => projectScope(eb, role, userId, ["developer"]));
}

/** Fila 35-36 — el listado de proyectos del developer, con su avance. */
const projectsProcedure = orpc
  .route({ method: "GET", path: "/projects" })
  .output(z.array(developerProjectListItemSchema))
  .handler(async ({ context }) => {
    const proyectos = await misProyectos(
      context.user.id,
      context.user.role as "admin" | "developer"
    )
      .orderBy("createdAt", "desc")
      .execute();

    const ids = proyectos.map((p) => p.id);
    // **El "Price from" de la captura 35-36 es una agregación, no un campo**, y
    // el progreso también. Los dos los calcula `agregadosDeProyectos`
    // (`domain/project-aggregates.ts`), compartido con el perfil del
    // desarrollador: la regla de las dos monedas estaba escrita acá y hacía
    // falta igual allá.
    const agregados = await agregadosDeProyectos(ids);

    return proyectos.map((proyecto) => {
      // `sizeMinM2`/`sizeMaxM2` se descartan a propósito: son de la captura 60
      // y `developerProjectListItemSchema` es estricto, así que una clave de
      // más rechaza la fila entera.
      const { sizeMinM2: _min, sizeMaxM2: _max, ...resto } = agregados.get(proyecto.id)!;
      return { ...proyecto, ...resto };
    });
  });
const projectsHandler = new OpenAPIHandler({ projectsProcedure });

router.get(
  "/projects",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res, next) => {
    const { matched } = await projectsHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** Fila 37 — el detalle, que en la captura es una grilla de acciones + 3 stats. */
const projectByIdProcedure = os
  .route({ method: "GET", path: "/projects/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(developerProjectDetailSchema)
  .handler(async ({ input }) => {
    const proyecto = await db
      .selectFrom("Project")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!proyecto) throw new ORPCError("NOT_FOUND", { message: "Project not found" });

    const stages = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", proyecto.id)
      .orderBy("sequenceOrder", "asc")
      .execute();

    const evidencia = await db
      .selectFrom("Evidence")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .where("projectId", "=", proyecto.id)
      .executeTakeFirst();

    return {
      ...proyecto,
      stages,
      evidenceCount: Number(evidencia?.total ?? 0)
    };
  });
const projectByIdHandler = new OpenAPIHandler({ projectByIdProcedure });

router.get(
  "/projects/:id",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  async (req, res, next) => {
    const { matched } = await projectByIdHandler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
    if (!matched) next();
  }
);

/**
 * Fila 34b-34c — crear un desarrollo.
 *
 * **`RESOURCE_ALREADY_EXISTS`/`RELATED_RESOURCE_NOT_FOUND` son errores con
 * nombre** (ver `relanzarRestriccionComoOrpc` en `_shared.ts`): un slug
 * repetido choca contra `Project.slug` DENTRO de la transacción, y
 * `OpenAPIHandler` nunca llama a `next(err)` — sin capturarlo acá, oRPC lo
 * respondería como su propio 500 genérico, la regresión que
 * `test/constraint-errors.test.ts` existe para impedir.
 */
const createProjectProcedure = orpc
  .errors({
    RESOURCE_ALREADY_EXISTS: { status: 409, message: "Resource already exists" },
    RELATED_RESOURCE_NOT_FOUND: { status: 400, message: "A referenced resource does not exist" }
  })
  .route({ method: "POST", path: "/projects", successStatus: 201 })
  .input(createDeveloperProjectSchema)
  .output(developerProjectCreateResultSchema)
  .handler(async ({ input, context, errors }) => {
    const ahora = new Date();

    // Proyecto + membresía del creador + las 10 etapas del Stage template
    // (M2-D1 §5.2, captura 34C) nacen juntos, atómicos a nivel de base: las
    // 10 filas existen todas o ninguna. El anclaje on-chain de cada una es
    // aparte —no puede ser atómico, cada mint es su propia transacción de
    // Cardano (D-083, y el validador rechaza acuñar más de un hilo por tx:
    // `mint_rejects_two_threads_in_one_tx`)— y se intenta después, en loop,
    // tolerando que alguna quede `Failed` (D-059: la declaración off-chain
    // nunca depende del anclaje).
    //
    // `.catch(...)` y no `try/catch`: `relanzarRestriccionComoOrpc` devuelve
    // `never`, así que el tipo de la promesa entera sigue siendo el de la
    // rama que sí resuelve — sin esto hay que anotar a mano el tipo de un
    // `let` para el resultado de la transacción, y esa anotación es la que se
    // desincroniza el día que el `return` de adentro cambie.
    const { proyecto, stages } = await db
      .transaction()
      .execute(async (trx) => {
        const proyecto = await trx
          .insertInto("Project")
          .values({
            id: createId(),
            name: input.name,
            slug: input.slug,
            address: input.address ?? null,
            city: input.city ?? null,
            country: input.country ?? null,
            totalUnits: input.totalUnits ?? 0,
            estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : null,
            status: "planning",
            createdAt: ahora,
            updatedAt: ahora
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        // Quien crea el proyecto queda como su developer: sin esto, el creador
        // no pasaría su propia segunda capa de autorización (regla 5).
        await trx
          .insertInto("ProjectMember")
          .values({
            id: createId(),
            userId: context.user.id,
            projectId: proyecto.id,
            membershipRole: "developer",
            createdAt: ahora
          })
          .execute();

        const stages = await trx
          .insertInto("Stage")
          .values(
            DEFAULT_STAGE_CATALOG.map((etapa) => ({
              id: createId(),
              projectId: proyecto.id,
              name: etapa.name,
              sequenceOrder: etapa.sequenceOrder,
              state: INITIAL_STAGE_STATE,
              // D-061: todo stage es validation-critical por default.
              validationCritical: true,
              createdAt: ahora,
              updatedAt: ahora
            }))
          )
          .returningAll()
          .execute();

        return { proyecto, stages };
      })
      .catch((err) => relanzarRestriccionComoOrpc(err, errors));

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "CREATE_PROJECT",
      entityType: "Project",
      entityId: proyecto.id
    });

    // El mint de cada etapa, uno por uno — nunca en batch (el validador lo
    // rechaza) y nunca bloqueando entre sí: si la etapa 6 falla, las demás
    // igual se intentan, y la 6 queda declarada con su anclaje en `Failed`,
    // reintentable después (`retry-anchor`) como cualquier mint que falla.
    const anclajes: OnChainEventRow[] = [];
    for (const stage of stages) {
      const evento = await recordOnChainEvent({
        projectId: stage.projectId,
        stageId: stage.id,
        eventType: "STAGE_CREATED",
        fromState: null,
        toState: stage.state
      });
      anclajes.push(await anchorEvent(evento, stage, null));
    }

    return {
      ...proyecto,
      // `anclajes[i]` existe siempre: un `push` por cada `stage` del mismo
      // `for`, en el mismo orden — `noUncheckedIndexedAccess` no puede verlo,
      // el invariante es del loop de arriba.
      stages: stages.map((stage, i) => ({ ...stage, anchor: anclajes[i]! }))
    };
  });
const createProjectHandler = new OpenAPIHandler({ createProjectProcedure });

router.post(
  "/projects",
  authorize({ roles: ["admin", "developer"], acceso: "soloRol" }),
  async (req, res, next) => {
    const { matched } = await createProjectHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** Fila 45 — el avance de obra a través de todos los proyectos. */
const progressProcedure = orpc
  .route({ method: "GET", path: "/progress" })
  .output(z.array(developerProgressItemSchema))
  .handler(async ({ context }) => {
    const ids = (
      await misProyectos(context.user.id, context.user.role as "admin" | "developer").execute()
    ).map((p) => p.id);

    if (ids.length === 0) return [];

    return db
      .selectFrom("Stage")
      .innerJoin("Project", "Project.id", "Stage.projectId")
      .select([
        "Stage.id as stageId",
        "Stage.name as stageName",
        "Stage.sequenceOrder as sequenceOrder",
        "Stage.state as state",
        "Stage.certifiedAt as certifiedAt",
        "Project.id as projectId",
        "Project.name as projectName",
        "Project.estimatedDelivery as estimatedDelivery"
      ])
      .where("Stage.projectId", "in", ids)
      .orderBy("Project.name", "asc")
      .orderBy("Stage.sequenceOrder", "asc")
      .execute();
  });
const progressHandler = new OpenAPIHandler({ progressProcedure });

router.get(
  "/progress",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res, next) => {
    const { matched } = await progressHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/**
 * Fila 46-47 — la documentación del developer, con su estado de anclaje.
 *
 * "Documento" acá es evidencia: el modelo no distingue todavía entre evidencia
 * de stage y documento suelto de proyecto (M3-SC-06). Cuando lo distinga, esta
 * ruta filtra; hoy devuelve todo con su estado real de prueba.
 */
const documentsProcedure = orpc
  .route({ method: "GET", path: "/documents" })
  .input(developerDocumentListQuerySchema)
  .output(z.array(developerDocumentSchema))
  .handler(async ({ input, context }) => {
    const ids = (
      await misProyectos(context.user.id, context.user.role as "admin" | "developer").execute()
    ).map((p) => p.id);

    if (ids.length === 0) return [];

    let query = db
      .selectFrom("Evidence")
      .leftJoin("OnChainEvent", "OnChainEvent.evidenceId", "Evidence.id")
      .select([
        "Evidence.id as id",
        "Evidence.originalFilename as filename",
        "Evidence.category as category",
        "Evidence.authoritative as authoritative",
        "Evidence.sha256Hash as sha256Hash",
        "Evidence.uploadedAt as uploadedAt",
        "OnChainEvent.txid as txid",
        "OnChainEvent.status as anchorStatus"
      ])
      .where("Evidence.projectId", "in", ids);

    // SPEC-209 (B-14): antes se traía TODA la evidencia de todos los
    // proyectos y se filtraba en memoria por `d.txid !== null`/`=== null` —
    // exactamente lo que un `where` sobre la columna ya joineada hace. Mismo
    // predicado, mismas filas: si `Evidence` tuviera más de un `OnChainEvent`
    // (el `leftJoin` los multiplicaría), este `where` cuenta lo mismo que
    // contaba el `.filter()` de antes, ni una fila más ni una menos.
    if (input.status === "anchored") {
      query = query.where("OnChainEvent.txid", "is not", null);
    } else if (input.status === "pending") {
      query = query.where("OnChainEvent.txid", "is", null);
    }

    return query.orderBy("Evidence.uploadedAt", "desc").execute();
  });
const documentsHandler = new OpenAPIHandler({ documentsProcedure });

router.get(
  "/documents",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res, next) => {
    const { matched } = await documentsHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/**
 * Fila 49 — el audit log, paginado por cursor.
 *
 * **Append-only** (M2-D4 P6): los eventos no se editan ni se borran. Si un
 * stage se re-ancla tras una remediación, el evento original queda y se agrega
 * uno nuevo. Esta ruta solo lee.
 */
const auditLogProcedure = orpc
  .route({ method: "GET", path: "/audit-log" })
  .input(auditLogQuerySchema)
  .output(paginatedResponseSchema(auditLogEntrySchema))
  .handler(async ({ input, context }) => {
    let query = db
      .selectFrom("AuditLog")
      .leftJoin("User", "User.id", "AuditLog.actorUserId")
      // **Acota a los proyectos del developer** (M2-D1 §4, M2-D4 §P6). Sin esto
      // devolvía la tabla entera, con el nombre y el rol de cada usuario del
      // sistema. El bypass de `admin` vive adentro de `auditScope`.
      .where((eb) => auditScope(eb, context.user.role, context.user.id, ["developer"]))
      .select([
        "AuditLog.id as id",
        "AuditLog.action as action",
        "AuditLog.entityType as entityType",
        "AuditLog.entityId as entityId",
        "AuditLog.metadataJson as metadataJson",
        "AuditLog.createdAt as createdAt",
        "User.fullName as actorName",
        "User.role as actorRole"
      ])
      .orderBy("AuditLog.createdAt", "desc")
      .limit(input.limit);

    if (input.category) {
      query = query.where("AuditLog.entityType", "=", input.category);
    }
    if (input.cursor) {
      query = query.where("AuditLog.createdAt", "<", new Date(input.cursor));
    }

    const items = await query.execute();
    const ultima = items.at(-1);

    return {
      items,
      nextCursor: ultima ? new Date(ultima.createdAt).toISOString() : null
    };
  });
const auditLogHandler = new OpenAPIHandler({ auditLogProcedure });

router.get(
  "/audit-log",
  authorize({
    roles: ["admin", "developer"],
    acceso: { scopeEnQuery: "auditScope(developer)" }
  }),
  async (req, res, next) => {
    const { matched } = await auditLogHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/**
 * Fila 46-47 — anclar un documento suelto — **M3-BE-14** y **M3-SC-06**.
 *
 * "Suelto" quiere decir que no cuelga del cierre de un stage: un permiso, un
 * plano aprobado, un certificado externo. El archivo ya está subido (la subida
 * es `POST /projects/:id/evidence`); esto es el segundo paso, el que el usuario
 * inicia apretando "Anclar" en el `DocumentCard` — **nunca automático**
 * (M2-D4 §6.3).
 *
 * Lo que se ancla es el SHA-256 del archivo, que es el ticket de entrada a la
 * cadena de prueba (D-027). Un documento sin hash no se puede anclar y no se
 * puede mostrar como verificado: es 400, no un anclaje vacío.
 *
 * **Idempotente** (regla 8): si ese documento ya tiene su TXID, devuelve el
 * mismo evento con 200 en vez de gastar otra transacción.
 */
const anchorDocumentProcedure = orpc
  .errors({ NO_HASH: { status: 400 } })
  .route({
    method: "POST",
    path: "/documents",
    outputStructure: "detailed",
    successStatus: 201
  })
  .input(anchorDocumentSchema)
  .output(
    z.union([
      z.strictObject({ status: z.literal(200), body: onChainEventSchema }),
      z.strictObject({ status: z.literal(201), body: onChainEventSchema })
    ])
  )
  .handler(async ({ input, context, errors }) => {
    const documento = await db
      .selectFrom("Evidence")
      .select(["id", "projectId", "stageId", "sha256Hash"])
      .where("id", "=", input.evidenceId)
      .executeTakeFirst();

    if (!documento) throw new ORPCError("NOT_FOUND", { message: "Document not found" });

    if (!documento.sha256Hash) {
      throw errors.NO_HASH({ message: "Document has no hash" });
    }

    await reconciliarParaLectura({ evidenceId: documento.id });

    const yaAnclado = await db
      .selectFrom("OnChainEvent")
      .selectAll()
      .where("evidenceId", "=", documento.id)
      .where("txid", "is not", null)
      .executeTakeFirst();

    if (yaAnclado) return { status: 200 as const, body: yaAnclado };

    const anchor = await anchorCommitmentEvent({
      projectId: documento.projectId,
      stageId: documento.stageId,
      evidenceId: documento.id,
      eventType: "DOCUMENT_ANCHOR",
      commitment: documento.sha256Hash,
      // Ref opaca: el id del registro, jamás el nombre del archivo (regla 2).
      reference: documento.id
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "ANCHOR_DOCUMENT",
      entityType: "Evidence",
      entityId: documento.id,
      metadata: { txid: anchor.txid, status: anchor.status }
    });

    return { status: 201 as const, body: anchor };
  });
const anchorDocumentHandler = new OpenAPIHandler({ anchorDocumentProcedure });

router.post(
  "/documents",
  authorize({
    roles: ["admin", "developer"],
    acceso: {
      // El `evidenceId` llega en el BODY, no en el path: por eso esta ruta hacía
      // la segunda capa a mano hasta el 2026-09-04. `nombre` conserva el
      // "Document not found" que ya devolvía — en esta superficie la evidencia
      // es un documento (M2-D5 fila 46), y devolver "Evidence not found" sería
      // filtrar el nombre de la tabla al cliente.
      proyecto: { via: "Evidence", param: "evidenceId", en: "body", nombre: "Document" },
      membresias: ["developer"]
    }
  }),
  async (req, res, next) => {
    const { matched } = await anchorDocumentHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

const kpisProcedure = orpc
  .route({ method: "GET", path: "/kpis" })
  .output(developerKpisSchema)
  .handler(async ({ context }) => {
    const ids = (await proyectosVisibles(context.user.id, context.user.role).execute()).map(
      (p) => p.id
    );

    if (ids.length === 0) {
      return {
        activeProjects: 0,
        totalUnits: 0,
        capitalRaisedMinorUnits: 0,
        averageProgress: 0,
        verifiedDocuments: 0
      };
    }

    const stages = await db
      .selectFrom("Stage")
      .select(["state"])
      .where("projectId", "in", ids)
      .execute();

    // El KPI cuenta `Confirmed`: sin esto, un anclaje que ya entró en un bloque
    // pero sigue `Pending` en la base lo hace contar de menos.
    await reconciliarParaLectura({ projectIds: ids });

    const anclados = await db
      .selectFrom("OnChainEvent")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .where("projectId", "in", ids)
      .where("eventType", "=", "EVIDENCE_ANCHOR")
      .where("status", "=", "Confirmed")
      .executeTakeFirst();

    const unidades = await db
      .selectFrom("Unit")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .where("projectId", "in", ids)
      .executeTakeFirst();

    // "Capital levantado" = suma de los contratos firmados. **No es plata que la
    // plataforma tenga** (D-021): es un monto declarado, en unidades mínimas
    // enteras (regla 1).
    const contratos = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select((eb) => eb.fn.sum<number>("Contract.totalMinorUnits").as("total"))
      .where("Unit.projectId", "in", ids)
      .executeTakeFirst();

    const completados = stages.filter((s) => s.state === "Completed").length;

    return {
      activeProjects: ids.length,
      totalUnits: Number(unidades?.total ?? 0),
      capitalRaisedMinorUnits: Number(contratos?.total ?? 0),
      averageProgress: stages.length ? Math.round((completados / stages.length) * 100) : 0,
      verifiedDocuments: Number(anclados?.total ?? 0)
    };
  });
const kpisHandler = new OpenAPIHandler({ kpisProcedure });

router.get(
  "/kpis",
  authorize({
    roles: ["admin", "developer"],
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

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 8
 * rutas migradas de este archivo, aparte del documento manual de la única que
 * no migró en `§D` (la subida multipart de `developer-evidencia.routes.ts`). */
export const developerOrpcRouter = {
  projectsProcedure,
  projectByIdProcedure,
  createProjectProcedure,
  progressProcedure,
  documentsProcedure,
  auditLogProcedure,
  anchorDocumentProcedure,
  kpisProcedure
};

export default router;
