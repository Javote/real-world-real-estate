import fs from "node:fs";
import path from "node:path";
import type { DeveloperKpis } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { notifyUnitInvestor } from "../domain/notify";
import { crearBundle } from "../domain/stage-transition";
import { db } from "../lib/db";
import { storage } from "../lib/storage";
import { uploadSingleEvidence } from "../lib/upload";
import { authenticate, projectScope, requireProjectAccess, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { avancePorProyecto, EVIDENCE_SAFE_COLUMNS, proyectosVisibles } from "./_shared";

// Superficie del developer (M2-D5 filas 34b-34c, 35-36, 37, 45, 46-47, 49).
//
// **Son los mismos datos que ya sirven las rutas genéricas, con la forma y el
// path que el backlog pide.** No es duplicación: `/projects` es CRUD nuestro y
// `/developer/projects` es una superficie del entregable, con su scope y su
// forma. El día que el CRUD genérico no le sirva a nadie, se borra.

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "developer"));

function misProyectos(userId: string, role: "admin" | "developer") {
  return db
    .selectFrom("Project")
    .selectAll("Project")
    .where((eb) => projectScope(eb, role, userId, ["developer"]));
}

/** Fila 35-36 — el listado de proyectos del developer, con su avance. */
router.get("/projects", async (req, res) => {
  const proyectos = await misProyectos(req.user!.id, req.user!.role as "admin" | "developer")
    .orderBy("createdAt", "desc")
    .execute();

  const ids = proyectos.map((p) => p.id);
  const stages = ids.length
    ? await db
        .selectFrom("Stage")
        .select(["projectId", "state"])
        .where("projectId", "in", ids)
        .execute()
    : [];

  return res.json(
    proyectos.map((proyecto) => {
      const suyos = stages.filter((s) => s.projectId === proyecto.id);
      const completados = suyos.filter((s) => s.state === "Completed").length;
      return {
        ...proyecto,
        stageCount: suyos.length,
        progress: suyos.length ? Math.round((completados / suyos.length) * 100) : 0
      };
    })
  );
});

/** Fila 37 — el detalle, que en la captura es una grilla de acciones + 3 stats. */
router.get(
  "/projects/:id",
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const proyecto = await db
      .selectFrom("Project")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!proyecto) return res.status(404).json({ message: "Project not found" });

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

    return res.json({
      ...proyecto,
      stages,
      evidenceCount: Number(evidencia?.total ?? 0)
    });
  }
);

/** Fila 34b-34c — crear un desarrollo. */
router.post("/projects", async (req, res) => {
  const schema = z.strictObject({
    name: z.string().min(1),
    slug: z.string().min(1),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    totalUnits: z.number().int().nonnegative().optional(),
    estimatedDelivery: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const ahora = new Date();
  const proyecto = await db
    .insertInto("Project")
    .values({
      id: createId(),
      name: parsed.data.name,
      slug: parsed.data.slug,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      country: parsed.data.country ?? null,
      totalUnits: parsed.data.totalUnits ?? 0,
      estimatedDelivery: parsed.data.estimatedDelivery
        ? new Date(parsed.data.estimatedDelivery)
        : null,
      status: "planning",
      createdAt: ahora,
      updatedAt: ahora
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Quien crea el proyecto queda como su developer: sin esto, el creador no
  // pasaría su propia segunda capa de autorización (regla 5).
  await db
    .insertInto("ProjectMember")
    .values({
      id: createId(),
      userId: req.user!.id,
      projectId: proyecto.id,
      membershipRole: "developer",
      createdAt: ahora
    })
    .execute();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "CREATE_PROJECT",
    entityType: "Project",
    entityId: proyecto.id
  });

  return res.status(201).json(proyecto);
});

/** Fila 45 — el avance de obra a través de todos los proyectos. */
router.get("/progress", async (req, res) => {
  const ids = (
    await misProyectos(req.user!.id, req.user!.role as "admin" | "developer").execute()
  ).map((p) => p.id);

  if (ids.length === 0) return res.json([]);

  const stages = await db
    .selectFrom("Stage")
    .innerJoin("Project", "Project.id", "Stage.projectId")
    .select([
      "Stage.id as stageId",
      "Stage.name as stageName",
      "Stage.sequenceOrder as sequenceOrder",
      "Stage.state as state",
      "Project.id as projectId",
      "Project.name as projectName"
    ])
    .where("Stage.projectId", "in", ids)
    .orderBy("Project.name", "asc")
    .orderBy("Stage.sequenceOrder", "asc")
    .execute();

  return res.json(stages);
});

/**
 * Fila 46-47 — la documentación del developer, con su estado de anclaje.
 *
 * "Documento" acá es evidencia: el modelo no distingue todavía entre evidencia
 * de stage y documento suelto de proyecto (M3-SC-06). Cuando lo distinga, esta
 * ruta filtra; hoy devuelve todo con su estado real de prueba.
 */
router.get("/documents", async (req, res) => {
  const schema = z.object({ status: z.enum(["anchored", "pending"]).optional() });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const ids = (
    await misProyectos(req.user!.id, req.user!.role as "admin" | "developer").execute()
  ).map((p) => p.id);

  if (ids.length === 0) return res.json([]);

  const documentos = await db
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
    .where("Evidence.projectId", "in", ids)
    .orderBy("Evidence.uploadedAt", "desc")
    .execute();

  const filtrados =
    parsed.data.status === "anchored"
      ? documentos.filter((d) => d.txid !== null)
      : parsed.data.status === "pending"
        ? documentos.filter((d) => d.txid === null)
        : documentos;

  return res.json(filtrados);
});

/**
 * Fila 49 — el audit log, paginado por cursor.
 *
 * **Append-only** (M2-D4 P6): los eventos no se editan ni se borran. Si un
 * stage se re-ancla tras una remediación, el evento original queda y se agrega
 * uno nuevo. Esta ruta solo lee.
 */
router.get("/audit-log", async (req, res) => {
  const schema = z.object({
    category: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  let query = db
    .selectFrom("AuditLog")
    .leftJoin("User", "User.id", "AuditLog.actorUserId")
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
    .limit(parsed.data.limit);

  if (parsed.data.category) {
    query = query.where("AuditLog.entityType", "=", parsed.data.category);
  }
  if (parsed.data.cursor) {
    query = query.where("AuditLog.createdAt", "<", new Date(parsed.data.cursor));
  }

  const items = await query.execute();
  const ultima = items.at(-1);

  return res.json({
    items,
    nextCursor: ultima ? new Date(ultima.createdAt).toISOString() : null
  });
});

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
router.post("/documents", async (req, res) => {
  const schema = z.strictObject({ evidenceId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const documento = await db
    .selectFrom("Evidence")
    .select(["id", "projectId", "stageId", "sha256Hash"])
    .where("id", "=", parsed.data.evidenceId)
    .executeTakeFirst();

  if (!documento) return res.status(404).json({ message: "Document not found" });

  // La segunda capa de autorización, hecha a mano porque el id que llega es de
  // la evidencia y no del proyecto: el developer ancla documentos de SUS
  // proyectos. Sin esto, cualquier developer anclaría el documento de otro.
  const propio = await misProyectos(req.user!.id, req.user!.role as "admin" | "developer")
    .where("Project.id", "=", documento.projectId)
    .executeTakeFirst();

  if (!propio) return res.status(403).json({ message: "Forbidden" });

  if (!documento.sha256Hash) {
    return res.status(400).json({ message: "Document has no hash", code: "NO_HASH" });
  }

  const yaAnclado = await db
    .selectFrom("OnChainEvent")
    .selectAll()
    .where("evidenceId", "=", documento.id)
    .where("txid", "is not", null)
    .executeTakeFirst();

  if (yaAnclado) return res.status(200).json(yaAnclado);

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
    actorUserId: req.user!.id,
    action: "ANCHOR_DOCUMENT",
    entityType: "Evidence",
    entityId: documento.id,
    metadata: { txid: anchor.txid, status: anchor.status }
  });

  return res.status(201).json(anchor);
});

router.get("/kpis", requireRole("admin", "developer"), async (req, res) => {
  const ids = (await proyectosVisibles(req.user!.id, req.user!.role).execute()).map((p) => p.id);

  if (ids.length === 0) {
    const vacio: DeveloperKpis = {
      activeProjects: 0,
      totalUnits: 0,
      capitalRaisedMinorUnits: 0,
      averageProgress: 0,
      verifiedDocuments: 0
    };
    return res.json(vacio);
  }

  const stages = await db
    .selectFrom("Stage")
    .select(["state"])
    .where("projectId", "in", ids)
    .execute();

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

  const kpis: DeveloperKpis = {
    activeProjects: ids.length,
    totalUnits: Number(unidades?.total ?? 0),
    capitalRaisedMinorUnits: Number(contratos?.total ?? 0),
    averageProgress: stages.length ? Math.round((completados / stages.length) * 100) : 0,
    verifiedDocuments: Number(anclados?.total ?? 0)
  };

  return res.json(kpis);
});

/** Fila 44b — las unidades de un proyecto, del lado del developer. */
router.get(
  "/projects/:id/units",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const unidades = await db
      .selectFrom("Unit")
      .selectAll()
      .where("projectId", "=", req.params.id)
      .orderBy("unitReference", "asc")
      .execute();

    return res.json(unidades);
  }
);

router.post(
  "/projects/:id/units",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.strictObject({
      unitReference: z.string().min(1).max(20),
      floor: z.number().int().optional(),
      sizeM2: z.number().int().positive().optional(),
      // Entero en unidades mínimas: nunca un decimal para dinero (regla 1).
      priceMinorUnits: z.number().int().nonnegative().optional(),
      currency: z.string().length(3).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const ahora = new Date();
    const unidad = await db
      .insertInto("Unit")
      .values({
        id: createId(),
        projectId: req.params.id,
        unitReference: parsed.data.unitReference,
        status: "available",
        floor: parsed.data.floor ?? null,
        sizeM2: parsed.data.sizeM2 ?? null,
        priceMinorUnits: parsed.data.priceMinorUnits ?? null,
        currency: parsed.data.currency ?? null,
        investorId: null,
        createdAt: ahora,
        updatedAt: ahora
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "CREATE_UNIT",
      entityType: "Unit",
      entityId: unidad.id
    });

    return res.status(201).json(unidad);
  }
);

router.patch(
  "/units/:id",
  requireRole("admin", "developer"),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.strictObject({
      status: z.enum(["available", "reserved", "sold", "delivered"]).optional(),
      floor: z.number().int().optional(),
      sizeM2: z.number().int().positive().optional(),
      priceMinorUnits: z.number().int().nonnegative().optional(),
      currency: z.string().length(3).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const unidad = await db
      .selectFrom("Unit")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!unidad) return res.status(404).json({ message: "Unit not found" });

    // Segunda capa: la unidad no trae `projectId` en el path, así que la
    // membresía se verifica con el proyecto de la unidad (regla 5).
    const permitido = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", unidad.projectId)
      .where((eb) => projectScope(eb, req.user!.role, req.user!.id, ["developer"]))
      .executeTakeFirst();

    if (!permitido) return res.status(403).json({ message: "Forbidden" });

    const actualizada = await db
      .updateTable("Unit")
      .set({ ...parsed.data, updatedAt: new Date() })
      .where("id", "=", unidad.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return res.json(actualizada);
  }
);

/** Fila 44 — el inventario cross-proyecto del developer. */
router.get("/units", requireRole("admin", "developer"), async (req, res) => {
  const proyectos = await db
    .selectFrom("Project")
    .select("id")
    .where((eb) => projectScope(eb, req.user!.role, req.user!.id, ["developer"]))
    .execute();

  const ids = proyectos.map((p) => p.id);
  if (ids.length === 0) return res.json([]);

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

  return res.json(unidades);
});

/** Fila 39 — el developer emite la invitación. */
router.post(
  "/projects/:id/invitations",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.strictObject({
      unitId: z.string().min(1),
      investorEmail: z.string().email(),
      amountMinorUnits: z.number().int().positive(),
      currency: z.string().length(3)
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const unidad = await db
      .selectFrom("Unit")
      .selectAll()
      .where("id", "=", parsed.data.unitId)
      .where("projectId", "=", req.params.id)
      .executeTakeFirst();

    if (!unidad) return res.status(400).json({ message: "Unit does not belong to project" });

    const ahora = new Date();
    const invitacion = await db
      .insertInto("Invitation")
      .values({
        id: createId(),
        projectId: req.params.id,
        unitId: unidad.id,
        investorEmail: parsed.data.investorEmail,
        amountMinorUnits: parsed.data.amountMinorUnits,
        currency: parsed.data.currency,
        status: "pending",
        createdById: req.user!.id,
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
      actorUserId: req.user!.id,
      action: "CREATE_INVITATION",
      entityType: "Invitation",
      entityId: invitacion.id
    });

    return res.status(201).json(invitacion);
  }
);

/** Fila 40-41 — los contratos de un proyecto, del lado del developer. */
router.get(
  "/projects/:id/contracts",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
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
        "User.fullName as investorName"
      ])
      .where("Unit.projectId", "=", req.params.id)
      .execute();

    return res.json(contratos);
  }
);

/** Fila 40-41 — liberar una etapa. **Ancla** (M3-SC-03). */
router.post(
  "/contracts/:id/releases/:stageNum",
  requireRole("admin", "developer"),
  async (req: Request<{ id: string; stageNum: string }>, res) => {
    const schema = z.strictObject({ amountMinorUnits: z.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const stageNumber = Number.parseInt(req.params.stageNum, 10);
    if (!Number.isInteger(stageNumber) || stageNumber < 1) {
      return res.status(400).json({ message: "stageNum must be a positive integer" });
    }

    const contrato = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select([
        "Contract.id as id",
        "Contract.unitId as unitId",
        "Contract.currency as currency",
        "Unit.projectId as projectId"
      ])
      .where("Contract.id", "=", req.params.id)
      .executeTakeFirst();

    if (!contrato) return res.status(404).json({ message: "Contract not found" });

    const permitido = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", contrato.projectId)
      .where((eb) => projectScope(eb, req.user!.role, req.user!.id, ["developer"]))
      .executeTakeFirst();

    if (!permitido) return res.status(403).json({ message: "Forbidden" });

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

    if (!stage) return res.status(404).json({ message: "Stage not found" });
    if (stage.state !== "Completed") {
      return res.status(409).json({
        message: "Stage is not certified yet",
        code: "STAGE_NOT_CERTIFIED",
        state: stage.state
      });
    }

    // Idempotencia (regla 8): el índice único (contrato, etapa) impide liberar
    // dos veces la misma.
    const yaLiberada = await db
      .selectFrom("PaymentRelease")
      .selectAll()
      .where("contractId", "=", contrato.id)
      .where("stageNumber", "=", stageNumber)
      .executeTakeFirst();

    if (yaLiberada) return res.status(200).json(yaLiberada);

    const ahora = new Date();
    const release = await db
      .insertInto("PaymentRelease")
      .values({
        id: createId(),
        contractId: contrato.id,
        stageNumber,
        amountMinorUnits: parsed.data.amountMinorUnits,
        releasedById: req.user!.id,
        releasedAt: ahora
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const anchor = await anchorCommitmentEvent({
      projectId: contrato.projectId,
      eventType: "PAYMENT_RELEASE",
      commitment: commitmentOf({
        contractId: contrato.id,
        stageNumber,
        amountMinorUnits: parsed.data.amountMinorUnits,
        releasedAt: ahora.toISOString()
      }),
      reference: release.id,
      stageId: stage.id
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "RELEASE_PAYMENT",
      entityType: "PaymentRelease",
      entityId: release.id,
      metadata: { stageNumber, txid: anchor.txid }
    });

    return res.status(201).json({ ...release, anchor });
  }
);

/**
 * Fila 38 y 44c — la subida del developer, scopeada al stage — **M3-BE-13** y
 * **M3-SC-02**, patrones P4 y P5.
 *
 * Es la MISMA subida que `POST /projects/:id/evidence` con el path y la forma
 * que el backlog pide, y con una diferencia que no es cosmética: acá el stage
 * es obligatorio y **la respuesta trae el Merkle root y el TXID en el mismo
 * request**. M2-D5 §2.2 lo fija: *"back end submits to Cardano; client awaits
 * success with TXID/Merkle root in the same response"* — es lo que alimenta el
 * `AnchoringSuccessModal`, la única superficie de prueba que se abre sola
 * (M2-D4 §6.3).
 *
 * **El bundle se rearma en cada subida.** Cada uno es un acta del conjunto que
 * existía en ese momento, no un índice que se edita: el root ya anclado tiene
 * que seguir verificando después de que se suba el archivo siguiente.
 *
 * **La asimetría de siempre** (D-059): el archivo y su hash quedan escritos
 * aunque el anclaje falle. En ese caso `anchor.status` es `Failed`, el TXID es
 * `null` y la UI muestra "Pendiente" — nunca "Verificado" (regla 17).
 */
router.post(
  "/projects/:id/stages/:stageId/evidence",
  requireRole("admin", "developer"),
  requireProjectAccess({ param: "id" }, ["developer"]),
  (req, res, next) => {
    uploadSingleEvidence(req, res, (err) => (err ? next(err) : next()));
  },
  async (req: Request<{ id: string; stageId: string }>, res) => {
    const { id: projectId, stageId } = req.params;

    if (!req.file) return res.status(400).json({ message: "File is required" });

    const borrarHuerfano = () => {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    };

    const schema = z.object({
      evidenceType: z.enum(["document", "photo", "certificate"]),
      category: z.string().min(1),
      description: z.string().max(2000).optional(),
      authoritative: z
        .string()
        .optional()
        .transform((v) => v === "true")
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      borrarHuerfano();
      return res.status(400).json(parsed.error.flatten());
    }

    const stage = await db
      .selectFrom("Stage")
      .selectAll()
      .where("id", "=", stageId)
      .where("projectId", "=", projectId)
      .executeTakeFirst();

    if (!stage) {
      borrarHuerfano();
      return res.status(404).json({ message: "Stage does not belong to project" });
    }

    const guardado = await storage.put({
      localPath: path.resolve(req.file.path),
      key: `evidence/${projectId}/${req.file.filename}`,
      contentType: req.file.mimetype
    });

    if (storage.driver === "s3" && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const now = new Date();
    const creada = await db
      .insertInto("Evidence")
      .values({
        id: createId(),
        projectId,
        stageId,
        uploadedById: req.user!.id,
        evidenceType: parsed.data.evidenceType,
        category: parsed.data.category,
        authoritative: parsed.data.authoritative ?? false,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: guardado.storageRef,
        sha256Hash: guardado.sha256,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    // El acta del conjunto que existe AHORA, con el archivo recién subido
    // adentro. Nunca es null: acabamos de insertar al menos una evidencia.
    const merkleRoot = await crearBundle(stage, req.user!.id);

    const bundle = await db
      .selectFrom("EvidenceBundle")
      .select(["id", "commitmentHash"])
      .where("stageId", "=", stage.id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .executeTakeFirstOrThrow();

    // Se ancla el ROOT del bundle, no el hash del archivo: el archivo suelto ya
    // tiene su propia ruta de anclaje (`POST /evidence/:id/anchor`), y lo que
    // el patrón P5 muestra es el root con las hojas debajo.
    const anchor = await anchorCommitmentEvent({
      projectId,
      stageId: stage.id,
      evidenceId: creada.id,
      eventType: "EVIDENCE_ANCHOR",
      commitment: bundle.commitmentHash,
      // Ref opaca: el id del bundle, nunca el nombre del archivo (regla 2).
      reference: bundle.id
    });

    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", creada.id)
      .executeTakeFirstOrThrow();

    // Los investors del proyecto se enteran de que hay evidencia nueva. Con
    // clave, no con copy (regla 15).
    const unidades = await db
      .selectFrom("Unit")
      .select("id")
      .where("projectId", "=", projectId)
      .where("investorId", "is not", null)
      .execute();

    for (const unidad of unidades) {
      await notifyUnitInvestor({
        unitId: unidad.id,
        category: "document",
        titleKey: "notifications.evidence.uploaded",
        params: { stageName: stage.name }
      });
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPLOAD_STAGE_EVIDENCE",
      entityType: "Evidence",
      entityId: creada.id,
      metadata: { bundleId: bundle.id, merkleRoot, txid: anchor.txid }
    });

    return res.status(201).json({
      evidence,
      bundleId: bundle.id,
      merkleRoot: bundle.commitmentHash,
      anchor
    });
  }
);

export default router;
