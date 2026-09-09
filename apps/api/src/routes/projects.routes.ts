import {
  addProjectMemberSchema,
  createProjectSchema,
  cuidParamSchema,
  projectListQuerySchema,
  updateProjectSchema
} from "@plataforma/shared";
import { type Request, Router } from "express";
import { createId } from "../db/id";
import { db } from "../lib/db";
import { sql } from "../lib/kysely";
import {
  ANY_MEMBERSHIP,
  authenticate,
  authorize,
  CUALQUIER_ROL,
  projectScope
} from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

router.get(
  "/",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { scopeEnQuery: "projectScope(cualquier membresía)" }
  }),
  async (req, res) => {
    // La regla 6 pide Zod en todo lo que entra, y este es el único endpoint
    // donde lo que entra es la query y no el body — se había quedado afuera,
    // con un `String(status) as any` que le mentía al compilador: `status`
    // podía ser cualquier cosa y Kysely lo tomaba como un `ProjectStatus`. No
    // era explotable (SQLite compara contra un valor que no existe y no
    // devuelve nada), pero es exactamente el agujero que la regla 6 cierra.
    const filtros = projectListQuerySchema.safeParse(req.query);

    if (!filtros.success) {
      return res.status(400).json(filtros.error.flatten());
    }

    const { status, city, q, sort, bbox } = filtros.data;

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
      const [minLon, minLat, maxLon, maxLat] = bbox.split(",").map(Number);
      // Un proyecto sin coordenadas no entra al mapa. No se le inventa un punto.
      query = query
        .where("longitude", ">=", minLon)
        .where("longitude", "<=", maxLon)
        .where("latitude", ">=", minLat)
        .where("latitude", "<=", maxLat);
    }

    const projectRows = await query
      .where((eb) => projectScope(eb, req.user!.role, req.user!.id, ANY_MEMBERSHIP))
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

    return res.json(projectList);
  }
);

router.post("/", authorize({ roles: ["admin"], acceso: "soloRol" }), async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const now = new Date();

  const project = await db
    .insertInto("Project")
    .values({
      id: createId(),
      name: parsed.data.name,
      slug: parsed.data.slug,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      country: parsed.data.country ?? null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      totalUnits: parsed.data.totalUnits,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : null,
      status: parsed.data.status,
      createdAt: now,
      updatedAt: now
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "CREATE_PROJECT",
    entityType: "Project",
    entityId: project.id
  });

  return res.status(201).json(project);
});

router.get(
  "/:id",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res) => {
    const project = await db
      .selectFrom("Project")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

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

    return res.json({ ...project, stages: stageRows, members });
  }
);

router.patch("/:id", authorize({ roles: ["admin"], acceso: "soloRol" }), async (req, res) => {
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const project = await db
    .updateTable("Project")
    .set({
      ...parsed.data,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : undefined,
      updatedAt: new Date()
    })
    .where("id", "=", req.params.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "UPDATE_PROJECT",
    entityType: "Project",
    entityId: project.id
  });

  return res.json(project);
});

router.delete(
  "/:id",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (req: Request<{ id: string }>, res) => {
    await db.deleteFrom("Project").where("id", "=", req.params.id).execute();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "DELETE_PROJECT",
      entityType: "Project",
      entityId: req.params.id
    });

    return res.status(204).send();
  }
);

router.get(
  "/:id/members",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req, res) => {
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
      .where("ProjectMember.projectId", "=", req.params.id)
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

    return res.json(members);
  }
);

router.post(
  "/:id/members",
  authorize({ roles: ["admin"], acceso: "soloRol" }),
  async (req: Request<{ id: string }>, res) => {
    const parsed = addProjectMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const member = await db
      .insertInto("ProjectMember")
      .values({
        id: createId(),
        userId: parsed.data.userId,
        projectId: req.params.id,
        membershipRole: parsed.data.membershipRole,
        createdAt: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "ADD_PROJECT_MEMBER",
      entityType: "ProjectMember",
      entityId: member.id
    });

    return res.status(201).json(member);
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
router.get(
  "/:id/documents",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ANY_MEMBERSHIP }
  }),
  async (req: Request<{ id: string }>, res) => {
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
      .where("Evidence.projectId", "=", req.params.id)
      .orderBy("Evidence.uploadedAt", "desc")
      .execute();

    return res.json(
      filas.map((f) => ({
        ...f,
        anchorStatus: f.txid ? (f.anchorStatus ?? "Confirmed") : "Pending"
      }))
    );
  }
);

/** Fila 21 — el esquema del edificio: las unidades por piso. */
router.get(
  "/:id/building-schematic",
  authorize({
    roles: CUALQUIER_ROL,
    acceso: { proyecto: { param: "id" }, membresias: ["developer", "buyer", "verifier"] }
  }),
  async (req: Request<{ id: string }>, res) => {
    const unidades = await db
      .selectFrom("Unit")
      .select(["id", "unitReference", "floor", "status"])
      .where("projectId", "=", req.params.id)
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

    return res.json([...pisos.entries()].map(([floor, units]) => ({ floor, units })));
  }
);

export default router;
