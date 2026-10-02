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
import { createId } from "../db/id.js";
import type { UserRole } from "../db/types.js";
import { listarInvitacionesACertificar } from "../domain/certifier-invitation.js";
import { agregadosDeProyectos } from "../domain/project-aggregates.js";
import { reconciliarParaLectura } from "../domain/reconcile.js";
import { en } from "../lib/arrays.js";
import { db } from "../lib/db.js";
import { sql } from "../lib/kysely.js";
import { conUsuario, delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc.js";
import {
  ANY_MEMBERSHIP,
  authenticate,
  authorize,
  CUALQUIER_ROL,
  projectScope
} from "../middlewares/auth.js";
import { paramValidator } from "../middlewares/validate-params.js";
import { writeAuditLog } from "../utils/audit.js";
import { conStages, relanzarRestriccionComoOrpc } from "./_shared.js";

const PREFIJO_ABSOLUTO = "/api/v1/projects";

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

    let query = db.selectFrom("Project").selectAll("Project");

    if (status) query = query.where("status", "=", status);
    if (city) query = query.where("city", "=", city);

    if (q) {
      const patron = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
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
      const partes = bbox.split(",").map(Number);
      const minLon = en(partes, 0);
      const minLat = en(partes, 1);
      const maxLon = en(partes, 2);
      const maxLat = en(partes, 3);
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
        if (sort === "delivery")
          return qb
            .orderBy(sql`case when estimatedDelivery is null then 1 else 0 end`)
            .orderBy("estimatedDelivery", "asc");
        return qb.orderBy("createdAt", "desc");
      })
      .execute();

    const projectList = await conStages(projectRows);

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
        latitude: input.latitude,
        longitude: input.longitude,
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
    const [project, stageRows, memberRows] = await Promise.all([
      db.selectFrom("Project").selectAll().where("id", "=", input.id).executeTakeFirst(),
      db
        .selectFrom("Stage")
        .selectAll()
        .where("projectId", "=", input.id)
        .orderBy("sequenceOrder", "asc")
        .execute(),
      db
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
        .execute()
    ]);

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe */
    if (!project) throw new ORPCError("NOT_FOUND", { message: "Project not found" });

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
    if (certifier?.role !== "verifier" || !certifier.isActive) {
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
          /* v8 ignore start -- @preserve: el handler ya confirmó que el proyecto y el certifier existen antes del insert */
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

const projectDocumentsProcedure = os
  .route({ method: "GET", path: "/{id}/documents" })
  .input(z.strictObject({ id: cuidParamSchema }))
  .output(z.array(projectDocumentSchema))
  .handler(async ({ input }) => {
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
        /* v8 ignore start -- @preserve: OnChainEvent.status es NOT NULL: si el LEFT JOIN trajo txid, trajo status */
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

    /* v8 ignore if -- @preserve: authorize({ proyecto }) ya confirmó que existe */
    if (!proyecto) throw new ORPCError("NOT_FOUND", { message: "Project not found" });
    if (!proyecto.organizationId) {
      throw new ORPCError("NOT_FOUND", { message: "Project has no developer organization" });
    }

    const organizacion = await db
      .selectFrom("Organization")
      .select(["id", "name", "slug", "bio", "foundedYear"])
      .where("id", "=", proyecto.organizationId)
      .executeTakeFirst();

    /* v8 ignore if -- @preserve: FK Project.organizationId → Organization */
    if (!organizacion) throw new ORPCError("NOT_FOUND", { message: "Organization not found" });

    const proyectos = await db
      .selectFrom("Project")
      .selectAll()
      .where("organizationId", "=", proyecto.organizationId)
      .orderBy("createdAt", "desc")
      .execute();

    const ids = proyectos.map((p) => p.id);
    const agregados = await agregadosDeProyectos(ids);

    const unidades = ids.length
      ? /* v8 ignore start -- @preserve: ids siempre incluye al proyecto que se está mirando */
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
        yearsInBusiness: organizacion.foundedYear
          ? Math.max(0, anioActual - organizacion.foundedYear)
          : null
      },
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
