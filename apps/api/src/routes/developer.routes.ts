import {
  anchorDocumentSchema,
  auditLogQuerySchema,
  createDeveloperProjectSchema,
  DEFAULT_STAGE_CATALOG,
  type DeveloperKpis,
  developerDocumentListQuerySchema,
  INITIAL_STAGE_STATE
} from "@plataforma/shared";
import { type Request, Router } from "express";
import { createId } from "../db/id";
import type { OnChainEventRow } from "../db/types";
import { anchorCommitmentEvent } from "../domain/anchoring";
import { reconciliarParaLectura } from "../domain/reconcile";
import { anchorEvent, recordOnChainEvent } from "../domain/stage-transition";
import { db } from "../lib/db";
import { auditScope, authenticate, authorize, projectScope } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { proyectosVisibles } from "./_shared";

// Superficie del developer (M2-D5 filas 34b-34c, 35-36, 37, 45, 46-47, 49).
//
// **Son los mismos datos que ya sirven las rutas genéricas, con la forma y el
// path que el backlog pide.** No es duplicación: `/projects` es CRUD nuestro y
// `/developer/projects` es una superficie del entregable, con su scope y su
// forma. El día que el CRUD genérico no le sirva a nadie, se borra.

const router = Router();

router.use(authenticate);

function misProyectos(userId: string, role: "admin" | "developer") {
  return db
    .selectFrom("Project")
    .selectAll("Project")
    .where((eb) => projectScope(eb, role, userId, ["developer"]));
}

/** Fila 35-36 — el listado de proyectos del developer, con su avance. */
router.get(
  "/projects",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res) => {
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

    // **El "Price from" de la captura 35-36 es una agregación, no un campo.**
    // El precio vive en la unidad (`Unit.priceMinorUnits`) y no hay precio a
    // nivel proyecto: el "desde" es el mínimo de las unidades del proyecto.
    //
    // Sobre TODAS las unidades y no solo las disponibles, porque la captura lo
    // decide: Belgrano Park está "Delivered" —o sea, sin nada disponible— y aun
    // así muestra su precio. Filtrar por disponibilidad dejaría sin precio a
    // todo proyecto vendido.
    const unidades = ids.length
      ? await db
          .selectFrom("Unit")
          .select(["projectId", "priceMinorUnits", "currency"])
          .where("projectId", "in", ids)
          .where("priceMinorUnits", "is not", null)
          .execute()
      : [];

    return res.json(
      proyectos.map((proyecto) => {
        const suyos = stages.filter((s) => s.projectId === proyecto.id);
        const completados = suyos.filter((s) => s.state === "Completed").length;

        const conPrecio = unidades.filter((u) => u.projectId === proyecto.id);
        const monedas = new Set(conPrecio.map((u) => u.currency));

        // **Con dos monedas en el mismo proyecto no hay "desde" que se pueda
        // sostener**: comparar unidades mínimas de monedas distintas da un
        // número sin significado. Antes que un mínimo falso, ningún precio
        // (regla 17). Hoy no debería pasar; el día que pase, se ve.
        const barata =
          monedas.size === 1
            ? conPrecio.reduce((min, u) => (u.priceMinorUnits! < min.priceMinorUnits! ? u : min))
            : null;

        return {
          ...proyecto,
          stageCount: suyos.length,
          progress: suyos.length ? Math.round((completados / suyos.length) * 100) : 0,
          priceFromMinorUnits: barata?.priceMinorUnits ?? null,
          priceCurrency: barata?.currency ?? null
        };
      })
    );
  }
);

/** Fila 37 — el detalle, que en la captura es una grilla de acciones + 3 stats. */
router.get(
  "/projects/:id",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
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
router.post(
  "/projects",
  authorize({ roles: ["admin", "developer"], acceso: "soloRol" }),
  async (req, res) => {
    const parsed = createDeveloperProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const ahora = new Date();

    // Proyecto + membresía del creador + las 10 etapas del Stage template
    // (M2-D1 §5.2, captura 34C) nacen juntos, atómicos a nivel de base: las
    // 10 filas existen todas o ninguna. El anclaje on-chain de cada una es
    // aparte —no puede ser atómico, cada mint es su propia transacción de
    // Cardano (D-083, y el validador rechaza acuñar más de un hilo por tx:
    // `mint_rejects_two_threads_in_one_tx`)— y se intenta después, en loop,
    // tolerando que alguna quede `Failed` (D-059: la declaración off-chain
    // nunca depende del anclaje).
    const { proyecto, stages } = await db.transaction().execute(async (trx) => {
      const proyecto = await trx
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

      // Quien crea el proyecto queda como su developer: sin esto, el creador
      // no pasaría su propia segunda capa de autorización (regla 5).
      await trx
        .insertInto("ProjectMember")
        .values({
          id: createId(),
          userId: req.user!.id,
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
            progressPercentage: null,
            createdAt: ahora,
            updatedAt: ahora
          }))
        )
        .returningAll()
        .execute();

      return { proyecto, stages };
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
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

    return res.status(201).json({
      ...proyecto,
      stages: stages.map((stage, i) => ({ ...stage, anchor: anclajes[i] }))
    });
  }
);

/** Fila 45 — el avance de obra a través de todos los proyectos. */
router.get(
  "/progress",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res) => {
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
  }
);

/**
 * Fila 46-47 — la documentación del developer, con su estado de anclaje.
 *
 * "Documento" acá es evidencia: el modelo no distingue todavía entre evidencia
 * de stage y documento suelto de proyecto (M3-SC-06). Cuando lo distinga, esta
 * ruta filtra; hoy devuelve todo con su estado real de prueba.
 */
router.get(
  "/documents",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res) => {
    const parsed = developerDocumentListQuerySchema.safeParse(req.query);
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
  }
);

/**
 * Fila 49 — el audit log, paginado por cursor.
 *
 * **Append-only** (M2-D4 P6): los eventos no se editan ni se borran. Si un
 * stage se re-ancla tras una remediación, el evento original queda y se agrega
 * uno nuevo. Esta ruta solo lee.
 */
router.get(
  "/audit-log",
  authorize({
    roles: ["admin", "developer"],
    acceso: { scopeEnQuery: "auditScope(developer)" }
  }),
  async (req, res) => {
    const parsed = auditLogQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    let query = db
      .selectFrom("AuditLog")
      .leftJoin("User", "User.id", "AuditLog.actorUserId")
      // **Acota a los proyectos del developer** (M2-D1 §4, M2-D4 §P6). Sin esto
      // devolvía la tabla entera, con el nombre y el rol de cada usuario del
      // sistema. El bypass de `admin` vive adentro de `auditScope`.
      .where((eb) => auditScope(eb, req.user!.role, req.user!.id, ["developer"]))
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
  async (req, res) => {
    const parsed = anchorDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const documento = await db
      .selectFrom("Evidence")
      .select(["id", "projectId", "stageId", "sha256Hash"])
      .where("id", "=", parsed.data.evidenceId)
      .executeTakeFirst();

    if (!documento) return res.status(404).json({ message: "Document not found" });

    if (!documento.sha256Hash) {
      return res.status(400).json({ message: "Document has no hash", code: "NO_HASH" });
    }

    await reconciliarParaLectura({ evidenceId: documento.id });

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
  }
);

router.get(
  "/kpis",
  authorize({
    roles: ["admin", "developer"],
    acceso: { scopeEnQuery: "projectScope(cualquier membresía)" }
  }),
  async (req, res) => {
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

    const kpis: DeveloperKpis = {
      activeProjects: ids.length,
      totalUnits: Number(unidades?.total ?? 0),
      capitalRaisedMinorUnits: Number(contratos?.total ?? 0),
      averageProgress: stages.length ? Math.round((completados / stages.length) * 100) : 0,
      verifiedDocuments: Number(anclados?.total ?? 0)
    };

    return res.json(kpis);
  }
);

export default router;
