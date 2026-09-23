import {
  addProjectMemberSchema,
  buildingSchematicFloorSchema,
  certifierInvitationSchema,
  createProjectSchema,
  cuidParamSchema,
  developerProfileSchema,
  inviteCertifierSchema,
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
import { listarInvitacionesACertificar } from "../domain/certifier-invitation";
import { agregadosDeProyectos } from "../domain/project-aggregates";
import { reconciliarParaLectura } from "../domain/reconcile";
import { en } from "../lib/arrays";
import { db } from "../lib/db";
import { sql } from "../lib/kysely";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
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
  delegarAOrpc(projectListHandler, PREFIJO_ABSOLUTO, conUsuario)
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

router.post(
  "/",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(createProjectHandler, PREFIJO_ABSOLUTO, conUsuario)
);

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

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (SPEC-018) */
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
  delegarAOrpc(projectByIdHandler, PREFIJO_ABSOLUTO)
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

    // Un id inexistente daba 500: `executeTakeFirstOrThrow()` tira un error
    // que `relanzarRestriccionComoOrpc` no clasifica (no es una restricción
    // violada). `GET /projects/:id` ya da 404 para lo mismo — esto lo alinea
    // (SPEC-018 §A5, mismo bug que `users.routes.ts` cerró en A4).
    const existe = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!existe) throw new ORPCError("NOT_FOUND", { message: "Project not found" });

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

router.patch(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(updateProjectHandler, PREFIJO_ABSOLUTO, conUsuario)
);

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
  delegarAOrpc(deleteProjectHandler, PREFIJO_ABSOLUTO, conUsuario)
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
  delegarAOrpc(projectMembersHandler, PREFIJO_ABSOLUTO)
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
  delegarAOrpc(addProjectMemberHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/**
 * SPEC-221 · el admin invita a un certifier a un proyecto (D-095).
 *
 * Es el reemplazo con pantalla de `POST /:id/members` para el caso que lo hacía
 * falta siempre: sumar el certifier a un proyecto nuevo. **No crea la
 * membresía**: la crea el certifier al aceptar (`certifier.routes.ts`), igual
 * que el buyer al aceptar la suya. El admin propone; el certifier decide si
 * certifica ese proyecto.
 *
 * Los tres rechazos tienen nombre porque cada uno es un error distinto del
 * admin y la pantalla los dice distinto: el usuario no es un certifier activo,
 * ya certifica este proyecto, o ya tiene una invitación sin responder.
 */
const inviteCertifierProcedure = orpc
  .errors({
    CERTIFIER_NOT_ELIGIBLE: { status: 400 },
    ALREADY_MEMBER: { status: 409 },
    INVITATION_ALREADY_PENDING: { status: 409 }
  })
  .route({ method: "POST", path: "/{id}/certifier-invitations", successStatus: 201 })
  .input(inviteCertifierSchema.extend({ id: cuidParamSchema }))
  .output(certifierInvitationSchema)
  .handler(async ({ input, context, errors }) => {
    const proyecto = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", input.id)
      .executeTakeFirst();
    if (!proyecto) throw new ORPCError("NOT_FOUND", { message: "Project not found" });

    const certifier = await db
      .selectFrom("User")
      .select(["role", "isActive"])
      .where("id", "=", input.certifierId)
      .executeTakeFirst();
    if (!certifier || certifier.role !== "verifier" || !certifier.isActive) {
      throw errors.CERTIFIER_NOT_ELIGIBLE({ message: "User is not an active certifier" });
    }

    const yaMiembro = await db
      .selectFrom("ProjectMember")
      .select("id")
      .where("projectId", "=", input.id)
      .where("userId", "=", input.certifierId)
      .where("membershipRole", "=", "verifier")
      .executeTakeFirst();
    if (yaMiembro) {
      throw errors.ALREADY_MEMBER({ message: "Certifier is already a member of this project" });
    }

    const id = createId();
    // El índice único PARCIAL (`CertifierInvitation_pending_key`) es la guarda:
    // dos requests concurrentes no pueden dejar dos invitaciones pendientes.
    await db
      .insertInto("CertifierInvitation")
      .values({
        id,
        projectId: input.id,
        certifierId: input.certifierId,
        status: "pending",
        createdById: context.user.id,
        createdAt: new Date()
      })
      .execute()
      .catch((err) =>
        relanzarRestriccionComoOrpc(err, {
          RESOURCE_ALREADY_EXISTS: () =>
            errors.INVITATION_ALREADY_PENDING({
              message: "Certifier already has a pending invitation for this project"
            }),
          /* v8 ignore start -- @preserve: el handler ya confirmó que el proyecto y el certifier existen antes del insert (SPEC-018) */
          RELATED_RESOURCE_NOT_FOUND: () =>
            new ORPCError("NOT_FOUND", { message: "Project or user not found" })
          /* v8 ignore stop -- @preserve */
        })
      );

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "INVITE_CERTIFIER",
      entityType: "CertifierInvitation",
      entityId: id,
      metadata: { membershipRole: "verifier" }
    });

    const [invitacion] = await listarInvitacionesACertificar({ id });
    return invitacion!;
  });
const inviteCertifierHandler = new OpenAPIHandler({ inviteCertifierProcedure });

router.post(
  "/:id/certifier-invitations",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(inviteCertifierHandler, PREFIJO_ABSOLUTO, conUsuario)
);

/** SPEC-221 · las invitaciones a certificar de un proyecto, para la pantalla del admin. */
const projectCertifierInvitationsProcedure = orpc
  .route({ method: "GET", path: "/{id}/certifier-invitations" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(certifierInvitationSchema))
  .handler(async ({ input }) => listarInvitacionesACertificar({ projectId: input.id }));
const projectCertifierInvitationsHandler = new OpenAPIHandler({
  projectCertifierInvitationsProcedure
});

router.get(
  "/:id/certifier-invitations",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  delegarAOrpc(projectCertifierInvitationsHandler, PREFIJO_ABSOLUTO, conUsuario)
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
        /* v8 ignore start -- @preserve: OnChainEvent.status es NOT NULL: si el LEFT JOIN trajo txid, trajo status (SPEC-018) */
        anchorStatus: f.txid ? (f.anchorStatus ?? "Confirmed") : "Pending"
        /* v8 ignore stop -- @preserve */
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
  delegarAOrpc(projectDocumentsHandler, PREFIJO_ABSOLUTO)
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
  delegarAOrpc(buildingSchematicHandler, PREFIJO_ABSOLUTO)
);

/**
 * **Capturas 59-60 · el perfil de la organización desarrolladora** (SPEC-220).
 *
 * Cuelga de `/projects/:id` y no de `/developer/:orgId` por tres razones, y la
 * tercera es la que decide: M2-D1 la describe como *"linked from project"*;
 * `/developer/*` ya es el área autenticada del developer y meter ahí una
 * pantalla que mira un investor se presta a confusión; y **la autorización ya
 * está resuelta** — el investor ve al desarrollador de una obra de la que es
 * miembro, sin inventar una regla de permisos nueva para una entidad nueva.
 *
 * 404 cuando el proyecto no tiene organización: los 7 proyectos anteriores a
 * la migración 0010 no la tienen, y una pantalla de perfil vacía diría menos
 * que no ofrecerla. El front solo dibuja el link cuando hay `organizationId`.
 */
const projectDeveloperProcedure = os
  .route({ method: "GET", path: "/{id}/developer" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(developerProfileSchema)
  .handler(async ({ input }) => {
    const proyecto = await db
      .selectFrom("Project")
      .select("organizationId")
      .where("id", "=", input.id)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe (SPEC-018) */
    if (!proyecto) throw new ORPCError("NOT_FOUND", { message: "Project not found" });
    if (!proyecto.organizationId) {
      throw new ORPCError("NOT_FOUND", { message: "Project has no developer organization" });
    }

    const organizacion = await db
      .selectFrom("Organization")
      .select(["id", "name", "slug", "bio", "foundedYear"])
      .where("id", "=", proyecto.organizationId)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: FK Project.organizationId → Organization (SPEC-018) */
    if (!organizacion) throw new ORPCError("NOT_FOUND", { message: "Organization not found" });

    // Todas las obras de la organización, no solo la que se está mirando: la
    // captura 59 lista "Previous Projects" y la 60 sigue con "Active Projects".
    const proyectos = await db
      .selectFrom("Project")
      .selectAll()
      .where("organizationId", "=", proyecto.organizationId)
      .orderBy("createdAt", "desc")
      .execute();

    const ids = proyectos.map((p) => p.id);
    const agregados = await agregadosDeProyectos(ids);

    // Unidades de TODAS sus obras: "Units sold" e "investors" son del
    // desarrollador, no de una obra.
    const unidades = ids.length
      ? /* v8 ignore start -- @preserve: ids siempre incluye al proyecto que se está mirando (SPEC-018) */
        await db
          .selectFrom("Unit")
          .select(["status", "investorId"])
          .where("projectId", "in", ids)
          .execute()
      : [];
    /* v8 ignore stop -- @preserve */

    const vendidas = unidades.filter((u) => u.status === "sold");
    const inversores = new Set(
      vendidas.map((u) => u.investorId).filter((id): id is string => id !== null)
    );

    const conAgregados = proyectos.map((p) => ({ ...p, ...agregados.get(p.id)! }));
    const anioActual = new Date().getUTCFullYear();

    return developerProfileSchema.parse({
      organization: organizacion,
      stats: {
        projectsDelivered: proyectos.filter((p) => p.status === "completed").length,
        unitsSold: vendidas.length,
        investors: inversores.size,
        // `null` y no 0 cuando no lo declaró: "0 años en el rubro" es una
        // afirmación, "no lo dijo" no lo es.
        yearsInBusiness: organizacion.foundedYear
          ? Math.max(0, anioActual - organizacion.foundedYear)
          : null
      },
      // Entregado es pasado; todo lo demás sigue en curso. `delayed` es una
      // obra activa con problemas, no una obra previa.
      previousProjects: conAgregados.filter((p) => p.status === "completed"),
      activeProjects: conAgregados.filter((p) => p.status !== "completed")
    });
  });
const projectDeveloperHandler = new OpenAPIHandler({ projectDeveloperProcedure });

router.get(
  "/:id/developer",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  delegarAOrpc(projectDeveloperHandler, PREFIJO_ABSOLUTO)
);

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de las
 * rutas migradas. */
export const projectsOrpcRouter = {
  projectListProcedure,
  createProjectProcedure,
  projectByIdProcedure,
  updateProjectProcedure,
  deleteProjectProcedure,
  projectMembersProcedure,
  addProjectMemberProcedure,
  inviteCertifierProcedure,
  projectCertifierInvitationsProcedure,
  projectDocumentsProcedure,
  buildingSchematicProcedure,
  projectDeveloperProcedure
};

export default router;
