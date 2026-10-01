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
  geocodeQuerySchema,
  geocodeResultSchema,
  INITIAL_STAGE_STATE,
  onChainEventSchema,
  paginatedResponseSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import type { OnChainEventRow, UserRole } from "../db/types";
import { anclarEvidenciaUnaVez } from "../domain/anchoring";
import { agregadosDeProyectos } from "../domain/project-aggregates";
import { reconciliarParaLectura } from "../domain/reconcile";
import { anchorEvent, recordOnChainEvent } from "../domain/stage-transition";
import { db } from "../lib/db";
import { geocodificador } from "../lib/geocode";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { auditScope, authenticate, authorize, projectScope } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { proyectosVisibles, relanzarRestriccionComoOrpc } from "./_shared";

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
    const agregados = await agregadosDeProyectos(ids);

    return proyectos.map((proyecto) => {
      const { sizeMinM2: _min, sizeMaxM2: _max, ...resto } = agregados.get(proyecto.id)!;
      return { ...proyecto, ...resto };
    });
  });
const projectsHandler = new OpenAPIHandler({ projectsProcedure });

router.get(
  "/projects",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  delegarAOrpc(projectsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

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

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe */
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
      /* v8 ignore start -- @preserve: COUNT(*) siempre devuelve una fila */
      evidenceCount: Number(evidencia?.total ?? 0)
      /* v8 ignore stop -- @preserve */
    };
  });
const projectByIdHandler = new OpenAPIHandler({ projectByIdProcedure });

router.get(
  "/projects/:id",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  delegarAOrpc(projectByIdHandler, PREFIJO_ABSOLUTO)
);

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
            latitude: input.latitude,
            longitude: input.longitude,
            totalUnits: input.totalUnits ?? 0,
            estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : null,
            status: "planning",
            createdAt: ahora,
            updatedAt: ahora
          })
          .returningAll()
          .executeTakeFirstOrThrow();

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
      stages: stages.map((stage, i) => ({ ...stage, anchor: anclajes[i]! }))
    };
  });
const createProjectHandler = new OpenAPIHandler({ createProjectProcedure });

router.post(
  "/projects",
  authorize({ roles: ["admin", "developer"], acceso: "soloRol" }),
  delegarAOrpc(createProjectHandler, PREFIJO_ABSOLUTO, conUsuario)
);

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
  delegarAOrpc(progressHandler, PREFIJO_ABSOLUTO, conUsuario)
);

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
  delegarAOrpc(documentsHandler, PREFIJO_ABSOLUTO, conUsuario)
);

async function conTxidDeLaTransicion<
  T extends { entityType: string; entityId: string; metadataJson: string | null; createdAt: Date }
>(items: T[]): Promise<T[]> {
  const sinTxid = new Map<T, { to: string; [k: string]: unknown }>();
  for (const item of items) {
    if (item.entityType !== "Stage" || !item.metadataJson) continue;
    const meta = JSON.parse(item.metadataJson) as { to?: string; txid?: string | null };
    if (meta.to && !meta.txid) sinTxid.set(item, { ...meta, to: meta.to });
  }
  if (sinTxid.size === 0) return items;

  const eventos = await db
    .selectFrom("OnChainEvent")
    .select(["stageId", "toState", "txid", "createdAt"])
    .where("eventType", "=", "STAGE_TRANSITION")
    .where("txid", "is not", null)
    .where("stageId", "in", [...new Set([...sinTxid.keys()].map((i) => i.entityId))])
    .orderBy("createdAt", "desc")
    .execute();

  return items.map((item) => {
    const meta = sinTxid.get(item);
    if (!meta) return item;
    const evento = eventos.find(
      (e) =>
        e.stageId === item.entityId &&
        e.toState === meta.to &&
        new Date(e.createdAt).getTime() <= new Date(item.createdAt).getTime()
    );
    return evento
      ? { ...item, metadataJson: JSON.stringify({ ...meta, txid: evento.txid }) }
      : item;
  });
}

const auditLogProcedure = orpc
  .route({ method: "GET", path: "/audit-log" })
  .input(auditLogQuerySchema)
  .output(paginatedResponseSchema(auditLogEntrySchema))
  .handler(async ({ input, context }) => {
    let query = db
      .selectFrom("AuditLog")
      .leftJoin("User", "User.id", "AuditLog.actorUserId")
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

    const items = await conTxidDeLaTransicion(await query.execute());
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
  delegarAOrpc(auditLogHandler, PREFIJO_ABSOLUTO, conUsuario)
);

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

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (Evidence, en el body) */
    if (!documento) throw new ORPCError("NOT_FOUND", { message: "Document not found" });

    /* v8 ignore if -- @preserve: Evidence.sha256Hash es NOT NULL */
    if (!documento.sha256Hash) {
      throw errors.NO_HASH({ message: "Document has no hash" });
    }

    await reconciliarParaLectura({ evidenceId: documento.id });

    const { evento: anchor, nuevo } = await anclarEvidenciaUnaVez({
      projectId: documento.projectId,
      stageId: documento.stageId,
      evidenceId: documento.id,
      eventType: "DOCUMENT_ANCHOR",
      commitment: documento.sha256Hash,
      reference: documento.id
    });

    if (!nuevo) return { status: 200 as const, body: anchor };

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
      proyecto: { via: "Evidence", param: "evidenceId", en: "body", nombre: "Document" },
      membresias: ["developer"]
    }
  }),
  delegarAOrpc(anchorDocumentHandler, PREFIJO_ABSOLUTO, conUsuario)
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

    const contratos = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select((eb) => eb.fn.sum<number>("Contract.totalMinorUnits").as("total"))
      .where("Unit.projectId", "in", ids)
      .executeTakeFirst();

    const completados = stages.filter((s) => s.state === "Completed").length;

    return {
      activeProjects: ids.length,
      /* v8 ignore start -- @preserve: COUNT(*) siempre devuelve una fila */
      totalUnits: Number(unidades?.total ?? 0),
      /* v8 ignore stop -- @preserve */
      capitalRaisedMinorUnits: Number(contratos?.total ?? 0),
      averageProgress: stages.length ? Math.round((completados / stages.length) * 100) : 0,
      /* v8 ignore start -- @preserve: COUNT(*) siempre devuelve una fila */
      verifiedDocuments: Number(anclados?.total ?? 0)
      /* v8 ignore stop -- @preserve */
    };
  });
const kpisHandler = new OpenAPIHandler({ kpisProcedure });

router.get(
  "/kpis",
  authorize({
    roles: ["admin", "developer"],
    acceso: { scopeEnQuery: "projectScope(cualquier membresía)" }
  }),
  delegarAOrpc(kpisHandler, PREFIJO_ABSOLUTO, conUsuario)
);

const geocodeProcedure = orpc
  .errors({
    GEOCODER_UNAVAILABLE: { status: 503, message: "The geocoding service is not available" }
  })
  .route({ method: "GET", path: "/geocode" })
  .input(geocodeQuerySchema)
  .output(geocodeResultSchema)
  .handler(({ input, errors }) =>
    geocodificador.buscar(input.q).catch(() => {
      throw errors.GEOCODER_UNAVAILABLE();
    })
  );
const geocodeHandler = new OpenAPIHandler({ geocodeProcedure });

router.get(
  "/geocode",
  authorize({ roles: ["admin", "developer"], acceso: "soloRol" }),
  delegarAOrpc(geocodeHandler, PREFIJO_ABSOLUTO, conUsuario)
);

export const developerOrpcRouter = {
  projectsProcedure,
  projectByIdProcedure,
  createProjectProcedure,
  progressProcedure,
  documentsProcedure,
  auditLogProcedure,
  anchorDocumentProcedure,
  kpisProcedure,
  geocodeProcedure
};

export default router;
