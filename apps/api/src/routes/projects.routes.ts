import {
  addProjectMemberSchema,
  buildingSchematicFloorSchema,
  createProjectSchema,
  cuidParamSchema,
  projectDetailSchema,
  projectDocumentSchema,
  projectListItemSchema,
  projectListQuerySchema,
  projectMemberSchema,
  projectMemberWithUserSchema,
  projectSchema,
  updateProjectSchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import type { UserRole } from "../db/types";
import { reconciliarParaLectura } from "../domain/reconcile";
import { en } from "../lib/arrays";
import { db } from "../lib/db";
import { sql } from "../lib/kysely";
import { OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import {
  ANY_MEMBERSHIP,
  authenticate,
  authorize,
  CUALQUIER_ROL,
  projectScope
} from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { relanzarRestriccionComoOrpc } from "./_shared";

// **SPEC-216 §E6 — migrado a oRPC (D-066)**, junto con `projects-obra.routes.ts`:
// comparten prefijo (`MONTAJE`, `app.ts`), mismo caso que los cuatro archivos
// de `/api/v1/developer` en `SPEC-212` §D — migrar uno no toca el
// `router.use(authenticate)` del otro, los dos ya lo declaran y coinciden.
//
// **`POST /` y `POST /:id/members` insertan contra un índice único**
// (`Project.slug`, `ProjectMember_userId_projectId_membershipRole_key`) y
// `POST /:id/members` además contra una FK (`userId`) — los tres envueltos en
// `relanzarRestriccionComoOrpc` (§Los `.errors()` que hacen falta de
// SPEC-216: dos de los tres sin test hoy, el riesgo es silencioso, no
// ausente). `PATCH /:id` también puede tocar `Project.slug` (es editable) y
// se envuelve igual.

const PREFIJO_ABSOLUTO = "/api/v1/projects";

/** El contexto que cada procedimiento recibe — siempre el usuario ya
 * autenticado por `authenticate`, corrido antes de que oRPC vea la request. */
export type ProjectsContext = { user: { id: string; email: string; role: UserRole } };
const orpc = os.$context<ProjectsContext>();

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

const projectListProcedure = orpc
  .route({ method: "GET", path: "/" })
  .input(projectListQuerySchema)
  .output(z.array(projectListItemSchema))
  .handler(async ({ input, context }) => {
    const { status, city, q, sort, bbox } = input;

    // El scope de visibilidad sale de `projectScope` y no de un query propio: es
    // la MISMA regla que aplica `canAccessProject` a un proyecto puntual (D-048,
    // D-049 — reimplementado con el query builder de Kysely, misma semántica:
    // `EXISTS` correlacionado, sin duplicar filas de un usuario con dos
    // membresías sobre el mismo proyecto).
    let query = db.selectFrom("Project").selectAll("Project");

    if (status) query = query.where("status", "=", status);
    if (city) query = query.where("city", "=", city);

    if (q) {
      // `escape` explícito: sin él, un `%` tipeado en el buscador matchea todo y
      // un `_` matchea cualquier carácter — el usuario cree que filtró y no.
      const patron = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      // Falso positivo de Semgrep en las dos líneas de abajo: es SQL
      // parametrizado por Kysely (el `sql` tag hace bind, no concatena), no
      // HTML — la regla lo confunde por la sintaxis de template literal.
      query = query.where((eb) =>
        eb.or([
          // nosemgrep: javascript.express.security.injection.raw-html-format.raw-html-format
          eb("name", "like", sql<string>`${patron} escape '\\'`),
          // nosemgrep: javascript.express.security.injection.raw-html-format.raw-html-format
          eb("city", "like", sql<string>`${patron} escape '\\'`)
        ])
      );
    }

    if (bbox) {
      // SPEC-208 (B-12): el regex de `bboxSchema` ya garantiza exactamente 4
      // números separados por coma — `en()` lo deja escrito en vez de que el
      // destructuring lo asuma en silencio.
      const partes = bbox.split(",").map(Number);
      const minLon = en(partes, 0);
      const minLat = en(partes, 1);
      const maxLon = en(partes, 2);
      const maxLat = en(partes, 3);
      // Un proyecto sin coordenadas no entra al mapa. No se le inventa un punto.
      query = query
        .where("longitude", ">=", minLon)
        .where("longitude", "<=", maxLon)
        .where("latitude", ">=", minLat)
        .where("latitude", "<=", maxLat);
    }

    const projectRows = await query
      .where((eb) => projectScope(eb, context.user.role, context.user.id, ANY_MEMBERSHIP))
      .$call((qb) => {
        if (sort === "name") return qb.orderBy("name", "asc");
        // `estimatedDelivery` nullable: las entregas sin fecha van al final en
        // vez de encabezar el listado por ser NULL.
        if (sort === "delivery")
          return qb
            .orderBy(sql`case when estimatedDelivery is null then 1 else 0 end`)
            .orderBy("estimatedDelivery", "asc");
        return qb.orderBy("createdAt", "desc");
      })
      .execute();

    const projectIds = projectRows.map((p) => p.id);
    const stageRows = projectIds.length
      ? await db
          .selectFrom("Stage")
          .selectAll()
          .where("projectId", "in", projectIds)
          .orderBy("sequenceOrder", "asc")
          .execute()
      : [];

    const stagesByProject = new Map<string, typeof stageRows>();
    for (const stage of stageRows) {
      const list = stagesByProject.get(stage.projectId) ?? [];
      list.push(stage);
      stagesByProject.set(stage.projectId, list);
    }

    const projectList = projectRows.map((project) => ({
      ...project,
      stages: stagesByProject.get(project.id) ?? []
    }));

    return z.array(projectListItemSchema).parse(projectList);
  });
const projectListHandler = new OpenAPIHandler({ projectListProcedure });

router.get(
  "/",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { scopeEnQuery: "projectScope(cualquier membresía)" }
  }),
  async (req, res, next) => {
    const { matched } = await projectListHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

const createProjectProcedure = orpc
  .errors({
    RESOURCE_ALREADY_EXISTS: { status: 409, message: "Resource already exists" },
    RELATED_RESOURCE_NOT_FOUND: { status: 400, message: "A referenced resource does not exist" }
  })
  .route({ method: "POST", path: "/", successStatus: 201 })
  .input(createProjectSchema)
  .output(projectSchema)
  .handler(async ({ input, context, errors }) => {
    const now = new Date();

    const project = await db
      .insertInto("Project")
      .values({
        id: createId(),
        name: input.name,
        slug: input.slug,
        address: input.address ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        totalUnits: input.totalUnits,
        estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : null,
        status: input.status,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow()
      .catch((err) => relanzarRestriccionComoOrpc(err, errors));

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "CREATE_PROJECT",
      entityType: "Project",
      entityId: project.id
    });

    return projectSchema.parse(project);
  });
const createProjectHandler = new OpenAPIHandler({ createProjectProcedure });

router.post("/", authorize({ roles: ["admin"], acceso: "soloRol" }), async (req, res, next) => {
  const { matched } = await createProjectHandler.handle(req, res, {
    prefix: PREFIJO_ABSOLUTO,
    context: { user: req.user! }
  });
  if (!matched) next();
});

const projectByIdProcedure = os
  .route({ method: "GET", path: "/{id}" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(projectDetailSchema)
  .handler(async ({ input }) => {
    const project = await db
      .selectFrom("Project")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!project) throw new ORPCError("NOT_FOUND", { message: "Project not found" });

    const stageRows = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", project.id)
      .orderBy("sequenceOrder", "asc")
      .execute();

    const memberRows = await db
      .selectFrom("ProjectMember")
      .innerJoin("User", "User.id", "ProjectMember.userId")
      .select([
        "ProjectMember.id",
        "ProjectMember.userId",
        "ProjectMember.projectId",
        "ProjectMember.membershipRole",
        "ProjectMember.createdAt",
        "User.id as user_id",
        "User.email as user_email",
        "User.fullName as user_fullName",
        "User.role as user_role"
      ])
      .where("ProjectMember.projectId", "=", project.id)
      .execute();

    const members = memberRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      projectId: row.projectId,
      membershipRole: row.membershipRole,
      createdAt: row.createdAt,
      user: {
        id: row.user_id,
        email: row.user_email,
        fullName: row.user_fullName,
        role: row.user_role
      }
    }));

    return projectDetailSchema.parse({ ...project, stages: stageRows, members });
  });
const projectByIdHandler = new OpenAPIHandler({ projectByIdProcedure });

router.get(
  "/:id",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res, next) => {
    const { matched } = await projectByIdHandler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
    if (!matched) next();
  }
);

const updateProjectProcedure = orpc
  .errors({
    RESOURCE_ALREADY_EXISTS: { status: 409, message: "Resource already exists" },
    RELATED_RESOURCE_NOT_FOUND: { status: 400, message: "A referenced resource does not exist" }
  })
  .route({ method: "PATCH", path: "/{id}" })
  .input(updateProjectSchema.extend({ id: cuidParamSchema }))
  .output(projectSchema)
  .handler(async ({ input, context, errors }) => {
    const { id, ...body } = input;

    const project = await db
      .updateTable("Project")
      .set({
        ...body,
        estimatedDelivery: body.estimatedDelivery ? new Date(body.estimatedDelivery) : undefined,
        updatedAt: new Date()
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow()
      .catch((err) => relanzarRestriccionComoOrpc(err, errors));

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "UPDATE_PROJECT",
      entityType: "Project",
      entityId: project.id
    });

    return projectSchema.parse(project);
  });
const updateProjectHandler = new OpenAPIHandler({ updateProjectProcedure });

router.patch("/:id", authorize({ roles: ["admin"], acceso: "soloRol" }), async (req, res, next) => {
  const { matched } = await updateProjectHandler.handle(req, res, {
    prefix: PREFIJO_ABSOLUTO,
    context: { user: req.user! }
  });
  if (!matched) next();
});

const deleteProjectProcedure = orpc
  .route({ method: "DELETE", path: "/{id}", successStatus: 204 })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    await db.deleteFrom("Project").where("id", "=", input.id).execute();

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "DELETE_PROJECT",
      entityType: "Project",
      entityId: input.id
    });
  });
const deleteProjectHandler = new OpenAPIHandler({ deleteProjectProcedure });

router.delete(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (req, res, next) => {
    const { matched } = await deleteProjectHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

const projectMembersProcedure = os
  .route({ method: "GET", path: "/{id}/members" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(projectMemberWithUserSchema))
  .handler(async ({ input }) => {
    const memberRows = await db
      .selectFrom("ProjectMember")
      .innerJoin("User", "User.id", "ProjectMember.userId")
      .select([
        "ProjectMember.id",
        "ProjectMember.userId",
        "ProjectMember.projectId",
        "ProjectMember.membershipRole",
        "ProjectMember.createdAt",
        "User.id as user_id",
        "User.email as user_email",
        "User.fullName as user_fullName",
        "User.role as user_role"
      ])
      .where("ProjectMember.projectId", "=", input.id)
      .execute();

    const members = memberRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      projectId: row.projectId,
      membershipRole: row.membershipRole,
      createdAt: row.createdAt,
      user: {
        id: row.user_id,
        email: row.user_email,
        fullName: row.user_fullName,
        role: row.user_role
      }
    }));

    return z.array(projectMemberWithUserSchema).parse(members);
  });
const projectMembersHandler = new OpenAPIHandler({ projectMembersProcedure });

router.get(
  "/:id/members",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res, next) => {
    const { matched } = await projectMembersHandler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
    if (!matched) next();
  }
);

const addProjectMemberProcedure = orpc
  .errors({
    RESOURCE_ALREADY_EXISTS: { status: 409, message: "Resource already exists" },
    RELATED_RESOURCE_NOT_FOUND: { status: 400, message: "A referenced resource does not exist" }
  })
  .route({ method: "POST", path: "/{id}/members", successStatus: 201 })
  .input(addProjectMemberSchema.extend({ id: cuidParamSchema }))
  .output(projectMemberSchema)
  .handler(async ({ input, context, errors }) => {
    const member = await db
      .insertInto("ProjectMember")
      .values({
        id: createId(),
        userId: input.userId,
        projectId: input.id,
        membershipRole: input.membershipRole,
        createdAt: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow()
      .catch((err) => relanzarRestriccionComoOrpc(err, errors));

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "ADD_PROJECT_MEMBER",
      entityType: "ProjectMember",
      entityId: member.id
    });

    return projectMemberSchema.parse(member);
  });
const addProjectMemberHandler = new OpenAPIHandler({ addProjectMemberProcedure });

router.post(
  "/:id/members",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (req, res, next) => {
    const { matched } = await addProjectMemberHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/**
 * Fila 06-07 — los documentos del proyecto (INV-PROJECT-DOCS-002).
 *
 * Es la evidencia del proyecto con su estado de prueba, en la forma que come el
 * `DocumentCard`: hash completo (regla 16) y TXID cuando existe.
 *
 * **`storagePath` no sale nunca** (D-011) y **el estado se deriva del TXID, no
 * se declara**: sin TXID el documento está "Pendiente", aunque tenga hash
 * (regla 17). Esa derivación vive acá y no en el cliente para que no haya dos
 * versiones de la misma regla.
 */
const projectDocumentsProcedure = os
  .route({ method: "GET", path: "/{id}/documents" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(projectDocumentSchema))
  .handler(async ({ input }) => {
    // **Reconciliar antes de consultar** (D-077): esta respuesta lleva
    // `anchorStatus`, y sin esto un anclaje que ya está en un bloque se sirve
    // como `Pending` para siempre. La regla vive en `reconcile.ts`: toda
    // lectura que devuelva el estado de un anclaje reconcilia su propio
    // alcance primero. Lo fija `test/reconcile-on-read.test.ts`.
    await reconciliarParaLectura({ projectId: input.id });

    const filas = await db
      .selectFrom("Evidence")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.evidenceId", "=", "Evidence.id")
          .on("OnChainEvent.eventType", "=", "EVIDENCE_ANCHOR")
      )
      .select([
        "Evidence.id as id",
        "Evidence.stageId as stageId",
        "Evidence.evidenceType as evidenceType",
        "Evidence.category as category",
        "Evidence.authoritative as authoritative",
        "Evidence.originalFilename as originalFilename",
        "Evidence.mimeType as mimeType",
        "Evidence.sizeBytes as sizeBytes",
        "Evidence.sha256Hash as sha256Hash",
        "Evidence.uploadedAt as uploadedAt",
        "OnChainEvent.txid as txid",
        "OnChainEvent.status as anchorStatus"
      ])
      .where("Evidence.projectId", "=", input.id)
      .orderBy("Evidence.uploadedAt", "desc")
      .execute();

    return z.array(projectDocumentSchema).parse(
      filas.map((f) => ({
        ...f,
        anchorStatus: f.txid ? (f.anchorStatus ?? "Confirmed") : "Pending"
      }))
    );
  });
const projectDocumentsHandler = new OpenAPIHandler({ projectDocumentsProcedure });

router.get(
  "/:id/documents",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res, next) => {
    const { matched } = await projectDocumentsHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO
    });
    if (!matched) next();
  }
);

/** Fila 21 — el esquema del edificio: las unidades por piso. */
const buildingSchematicProcedure = os
  .route({ method: "GET", path: "/{id}/building-schematic" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(buildingSchematicFloorSchema))
  .handler(async ({ input }) => {
    const unidades = await db
      .selectFrom("Unit")
      .select(["id", "unitReference", "floor", "status"])
      .where("projectId", "=", input.id)
      .orderBy("floor", "desc")
      .orderBy("unitReference", "asc")
      .execute();

    // Agrupado por piso, que es como lo dibuja la captura 21. Las unidades sin
    // piso van juntas al final en vez de inventarles uno.
    const pisos = new Map<number | null, typeof unidades>();
    for (const unidad of unidades) {
      const actual = pisos.get(unidad.floor) ?? [];
      actual.push(unidad);
      pisos.set(unidad.floor, actual);
    }

    return z
      .array(buildingSchematicFloorSchema)
      .parse([...pisos.entries()].map(([floor, units]) => ({ floor, units })));
  });
const buildingSchematicHandler = new OpenAPIHandler({ buildingSchematicProcedure });

router.get(
  "/:id/building-schematic",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ["developer", "buyer", "verifier"] }
  }),
  async (req, res, next) => {
    const { matched } = await buildingSchematicHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO
    });
    if (!matched) next();
  }
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las 9
 * rutas migradas. */
export const projectsOrpcRouter = {
  projectListProcedure,
  createProjectProcedure,
  projectByIdProcedure,
  updateProjectProcedure,
  deleteProjectProcedure,
  projectMembersProcedure,
  addProjectMemberProcedure,
  projectDocumentsProcedure,
  buildingSchematicProcedure
};

export default router;
