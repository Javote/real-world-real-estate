import fs from "node:fs";
import path from "node:path";
import { INITIAL_STAGE_STATE } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { PROJECT_STATUSES } from "../db/types";
import { anchorEvent, recordOnChainEvent } from "../domain/stage-transition";
import { db } from "../lib/db";
import { sql } from "../lib/kysely";
import { storage } from "../lib/storage";
import { uploadSingleEvidence } from "../lib/upload";
import {
  ANY_MEMBERSHIP,
  authenticate,
  projectScope,
  requireProjectAccess,
  requireRole
} from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared";

const router = Router();

router.use(authenticate);

/**
 * Filtros de `GET /projects`. La regla 6 pide Zod en todo lo que entra, y este
 * es el único endpoint donde lo que entra es la query y no el body — se había
 * quedado afuera, con un `String(status) as any` que le mentía al compilador:
 * `status` podía ser cualquier cosa y Kysely lo tomaba como un `ProjectStatus`.
 * No era explotable (SQLite compara contra un valor que no existe y no devuelve
 * nada), pero es exactamente el agujero que la regla 6 cierra.
 *
 * Los dos son opcionales y un valor inválido es 400, no un filtro ignorado en
 * silencio: quien filtra por `status=activo` tiene que enterarse de que ese
 * estado no existe.
 */
const listQuerySchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  city: z.string().min(1).optional(),
  /** Fila 04 — el typeahead. Busca en nombre y ciudad. */
  q: z.string().min(1).max(120).optional(),
  /** Fila 05 — el orden del `SelectDropdown`. */
  sort: z.enum(["recent", "name", "delivery"]).optional(),
  /**
   * Fila 03 — el viewport del mapa: `minLon,minLat,maxLon,maxLat`.
   *
   * Se valida acá y no en el handler porque un bbox mal formado tiene que ser
   * 400 y no un filtro que se ignora en silencio: quien pide el mapa y recibe
   * el listado entero no se entera de que su viewport no llegó.
   */
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional()
});

router.get("/", async (req, res) => {
  const filtros = listQuerySchema.safeParse(req.query);

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
    query = query.where((eb) =>
      eb.or([
        eb("name", "like", sql<string>`${patron} escape '\\'`),
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
});

router.post("/", requireRole("admin"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    totalUnits: z.number().int().nonnegative().default(0),
    estimatedDelivery: z.string().datetime().optional(),
    status: z.enum(["planning", "in_progress", "delayed", "completed"]).default("planning")
  });

  const parsed = schema.safeParse(req.body);
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

router.get("/:id", requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP), async (req, res) => {
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
});

router.patch("/:id", requireRole("admin"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    totalUnits: z.number().int().nonnegative().optional(),
    estimatedDelivery: z.string().datetime().optional(),
    status: z.enum(["planning", "in_progress", "delayed", "completed"]).optional()
  });

  const parsed = schema.safeParse(req.body);
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

router.delete("/:id", requireRole("admin"), async (req: Request<{ id: string }>, res) => {
  await db.deleteFrom("Project").where("id", "=", req.params.id).execute();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "DELETE_PROJECT",
    entityType: "Project",
    entityId: req.params.id
  });

  return res.status(204).send();
});

router.get(
  "/:id/members",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
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

router.post("/:id/members", requireRole("admin"), async (req: Request<{ id: string }>, res) => {
  const schema = z.object({
    userId: z.string().min(1),
    membershipRole: z.enum(["developer", "buyer", "verifier"])
  });

  const parsed = schema.safeParse(req.body);
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
});

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
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
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

router.get(
  "/:id/stages",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const result = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", req.params.id)
      .orderBy("sequenceOrder", "asc")
      .execute();

    return res.json(result);
  }
);

router.post(
  "/:id/stages",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.object({
      name: z.string().min(1),
      sequenceOrder: z.number().int().positive(),
      // `state` NO se acepta por body: todo stage nace en `Pending`. El
      // handler `mint` del validador lo exige para acuñar el hilo
      // (`valid_initial_datum`), así que dejar elegir el estado inicial acá
      // sería fabricar stages que no se pueden anclar.
      validationCritical: z.boolean().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    const now = new Date();

    const stage = await db
      .insertInto("Stage")
      .values({
        id: createId(),
        projectId: req.params.id,
        name: parsed.data.name,
        sequenceOrder: parsed.data.sequenceOrder,
        state: INITIAL_STAGE_STATE,
        // D-061: todo stage es validation-critical. El default deja de ser un
        // flag que alguien se olvida de marcar; desmarcarlo es explícito.
        validationCritical: parsed.data.validationCritical ?? true,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const evento = await recordOnChainEvent({
      projectId: stage.projectId,
      stageId: stage.id,
      eventType: "STAGE_CREATED",
      fromState: null,
      toState: stage.state
    });
    const anchor = await anchorEvent(evento, stage, null);

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_STAGE",
      entityType: "Stage",
      entityId: stage.id
    });

    return res.status(201).json({ ...stage, anchor });
  }
);

/**
 * Fila 09-12 — el mismo detalle de stage bajo el path anidado que el backlog
 * pide (INV-STAGE-DETAIL-001), con el bundle que lo compromete.
 *
 * **404 y no 403 si el stage es de otro proyecto**: el id existe, pero bajo
 * este proyecto no, y confirmar su existencia le diría a alguien con acceso a
 * un proyecto que hay un stage con ese id en otro.
 */
router.get(
  "/:id/stages/:stageId",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req: Request<{ id: string; stageId: string }>, res) => {
    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", req.params.stageId)
      .where("projectId", "=", req.params.id)
      .executeTakeFirst();

    if (!stage) return res.status(404).json({ message: "Stage not found" });

    const [evidences, bundle, eventos] = await Promise.all([
      // Sin `storagePath` (D-011): esta lista sale al cliente.
      db
        .selectFrom("Evidence")
        .select([
          "id",
          "evidenceType",
          "category",
          "authoritative",
          "originalFilename",
          "mimeType",
          "sizeBytes",
          "sha256Hash",
          "uploadedAt"
        ])
        .where("stageId", "=", stage.id)
        .orderBy("uploadedAt", "asc")
        .execute(),
      db
        .selectFrom("EvidenceBundle")
        .select(["id", "commitmentHash", "createdAt"])
        .where("stageId", "=", stage.id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirst(),
      db
        .selectFrom("OnChainEvent")
        .select(["eventType", "toState", "commitment", "txid", "status", "createdAt"])
        .where("stageId", "=", stage.id)
        .orderBy("eventIndex", "asc")
        .execute()
    ]);

    return res.json({ ...stage, evidences, bundle: bundle ?? null, events: eventos });
  }
);

router.get(
  "/:id/evidence",
  requireProjectAccess({ param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const rows = await db
      .selectFrom("Evidence")
      .innerJoin("User", "User.id", "Evidence.uploadedById")
      .leftJoin("Stage", "Stage.id", "Evidence.stageId")
      .select([
        ...EVIDENCE_SAFE_COLUMNS.map((c) => `Evidence.${c}` as const),
        "User.id as uploadedBy_id",
        "User.email as uploadedBy_email",
        "User.fullName as uploadedBy_fullName",
        "Stage.id as stage_id",
        "Stage.projectId as stage_projectId",
        "Stage.name as stage_name",
        "Stage.sequenceOrder as stage_sequenceOrder",
        "Stage.state as stage_state",
        "Stage.validationCritical as stage_validationCritical",
        "Stage.certifiedAt as stage_certifiedAt",
        "Stage.certifiedById as stage_certifiedById",
        "Stage.createdAt as stage_createdAt",
        "Stage.updatedAt as stage_updatedAt"
      ])
      .where("Evidence.projectId", "=", req.params.id)
      .orderBy("Evidence.uploadedAt", "desc")
      .execute();

    const evidence = rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      stageId: row.stageId,
      uploadedById: row.uploadedById,
      evidenceType: row.evidenceType,
      category: row.category,
      authoritative: row.authoritative,
      originalFilename: row.originalFilename,
      storedFilename: row.storedFilename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sha256Hash: row.sha256Hash,
      uploadedAt: row.uploadedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      uploadedBy: {
        id: row.uploadedBy_id,
        email: row.uploadedBy_email,
        fullName: row.uploadedBy_fullName
      },
      stage: row.stage_id
        ? {
            id: row.stage_id,
            projectId: row.stage_projectId,
            name: row.stage_name,
            sequenceOrder: row.stage_sequenceOrder,
            state: row.stage_state,
            validationCritical: row.stage_validationCritical,
            certifiedAt: row.stage_certifiedAt,
            certifiedById: row.stage_certifiedById,
            createdAt: row.stage_createdAt,
            updatedAt: row.stage_updatedAt
          }
        : null
    }));

    return res.json(evidence);
  }
);

router.post(
  "/:id/evidence",
  requireRole("admin", "developer"),
  // Antes de Multer a propósito: un request prohibido no llega a escribir el
  // archivo, así que no hay huérfano que limpiar por esta vía. La limpieza de
  // huérfanos sigue haciendo falta para lo que se rechaza DESPUÉS de Multer
  // (tipo, tamaño, y los errores de la ruta) — ver SPEC-012.
  requireProjectAccess({ param: "id" }, ["developer"]),
  (req, res, next) => {
    uploadSingleEvidence(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  },
  async (req: Request<{ id: string }>, res) => {
    const projectId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const schema = z.object({
      stageId: z.string().optional(),
      evidenceType: z.enum(["document", "photo", "certificate"]),
      category: z.string().min(1),
      authoritative: z
        .string()
        .optional()
        .transform((v) => v === "true")
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json(parsed.error.flatten());
    }

    const project = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", projectId)
      .executeTakeFirst();

    if (!project) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "Project not found" });
    }

    if (parsed.data.stageId) {
      const stage = await db
        .selectFrom("Stage")
        .select("id")
        .where("id", "=", parsed.data.stageId)
        .where("projectId", "=", projectId)
        .executeTakeFirst();

      if (!stage) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          message: "Stage does not belong to project"
        });
      }
    }

    // El archivo pasa por disco (Multer) y de ahí al storage configurado. El
    // hash que se guarda es el de **los bytes guardados**, no el del temporal:
    // con `s3`, `put` relee el objeto y lo rehashea. Ver `lib/storage.ts`.
    const guardado = await storage.put({
      localPath: path.resolve(req.file.path),
      key: `evidence/${projectId}/${req.file.filename}`,
      contentType: req.file.mimetype
    });

    // Con `s3` el temporal ya cumplió su función; con `disk` el "temporal" ES
    // el destino, así que no se borra.
    if (storage.driver === "s3" && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const sha256Hash = guardado.sha256;
    const now = new Date();

    const created = await db
      .insertInto("Evidence")
      .values({
        id: createId(),
        projectId,
        stageId: parsed.data.stageId ?? null,
        uploadedById: req.user!.id,
        evidenceType: parsed.data.evidenceType,
        category: parsed.data.category,
        authoritative: parsed.data.authoritative ?? false,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: guardado.storageRef,
        sha256Hash,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", created.id)
      .executeTakeFirst();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_EVIDENCE",
      entityType: "Evidence",
      entityId: created.id
    });

    return res.status(201).json(evidence);
  }
);

/** Fila 21 — el esquema del edificio: las unidades por piso. */
router.get(
  "/:id/building-schematic",
  requireProjectAccess({ param: "id" }, ["developer", "buyer", "verifier"]),
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
