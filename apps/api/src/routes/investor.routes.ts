import { randomBytes } from "node:crypto";
import type { DossierShare } from "@plataforma/shared";
import { type Notification, notificationQuerySchema, type UnreadCount } from "@plataforma/shared";
import { type Request, Router } from "express";
import { createId } from "../db/id";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { compileDossier } from "../domain/dossier";
import { db } from "../lib/db";
import { authenticate, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { renderTextPdf } from "../utils/pdf";
import { avancePorProyecto } from "./_shared";

// **Toda la superficie del investor, bajo `/api/v1/investor`** (M2-D5 §4).
//
// Antes vivía repartida en cinco routers agrupados por concepto de dominio
// —favoritos, unidades, dossier, notificaciones, invitaciones—, todos montados
// sobre `/api/v1` pelado. Eso volvía el orden de montaje de `app.ts` carga
// estructural: un `router.use(guard)` corre para TODA request que entra al
// router, matcheen o no sus rutas, así que el guard de OTRA superficie
// contestaba antes de que este router existiera para esa request (SPEC-015 §4).
//
// Ahora el prefijo es de este router y de nadie más, y el orden de montaje no
// puede romper nada. El precio es agrupar por prefijo en vez de por concepto
// —acá conviven unidades, dossier, contratos e invitaciones— y está bien: es
// como agrupa M2-D5 §4.
//
// **El aislamiento cross-rol es la regla de acceso de casi todo lo de acá**
// (M2-D1 §Cross-role data isolation): el investor ve SU unidad, SU contrato, SU
// dossier. Ese chequeo va en cada handler y no en un middleware porque el dato
// que decide —quién es el dueño— sale de la fila, no del token.

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "buyer"));

/** El investor ve SU dossier y ninguno más. */
async function dossierDeLaUnidad(unitId: string, user: { id: string; role: string }) {
  const dossier = await compileDossier(unitId);
  if (!dossier) return { error: 404 as const };
  if (user.role !== "admin" && dossier.investorId !== user.id) return { error: 403 as const };
  return { dossier };
}

router.get("/favorites", requireRole("admin", "buyer"), async (req, res) => {
  const favoritos = await db
    .selectFrom("Favorite")
    .innerJoin("Project", "Project.id", "Favorite.projectId")
    .selectAll("Project")
    .where("Favorite.userId", "=", req.user!.id)
    .orderBy("Favorite.createdAt", "desc")
    .execute();

  return res.json(favoritos);
});

router.post(
  "/favorites/:projectId",
  requireRole("admin", "buyer"),
  async (req: Request<{ projectId: string }>, res) => {
    const proyecto = await db
      .selectFrom("Project")
      .select("id")
      .where("id", "=", req.params.projectId)
      .executeTakeFirst();

    if (!proyecto) return res.status(404).json({ message: "Project not found" });

    // Idempotente: marcar dos veces no es un error, es la misma intención.
    await db
      .insertInto("Favorite")
      .values({ userId: req.user!.id, projectId: proyecto.id, createdAt: new Date() })
      .onConflict((oc) => oc.columns(["userId", "projectId"]).doNothing())
      .execute();

    return res.status(204).send();
  }
);

router.delete(
  "/favorites/:projectId",
  requireRole("admin", "buyer"),
  async (req: Request<{ projectId: string }>, res) => {
    await db
      .deleteFrom("Favorite")
      .where("userId", "=", req.user!.id)
      .where("projectId", "=", req.params.projectId)
      .execute();

    // 204 aunque no existiera: el estado final es el mismo y el cliente no
    // gana nada distinguiendo.
    return res.status(204).send();
  }
);

/** Fila 14 — My Units: las del investor autenticado. */
router.get("/units", requireRole("admin", "buyer"), async (req, res) => {
  const unidades = await db
    .selectFrom("Unit")
    .innerJoin("Project", "Project.id", "Unit.projectId")
    .select([
      "Unit.id as id",
      "Unit.unitReference as unitReference",
      "Unit.status as status",
      "Unit.sizeM2 as sizeM2",
      "Unit.priceMinorUnits as priceMinorUnits",
      "Unit.currency as currency",
      "Project.id as projectId",
      "Project.name as projectName",
      "Project.city as city"
    ])
    .where("Unit.investorId", "=", req.user!.id)
    .execute();

  const avance = await avancePorProyecto([...new Set(unidades.map((u) => u.projectId))]);

  return res.json(unidades.map((u) => ({ ...u, progress: avance.get(u.projectId) ?? 0 })));
});

/** Fila 15-18 — el detalle de la unidad, con los stages del proyecto y su anclaje. */
router.get(
  "/units/:id",
  requireRole("admin", "buyer"),
  async (req: Request<{ id: string }>, res) => {
    const unidad = await db
      .selectFrom("Unit")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .select([
        "Unit.id as id",
        "Unit.unitReference as unitReference",
        "Unit.status as status",
        "Unit.sizeM2 as sizeM2",
        "Unit.floor as floor",
        "Unit.priceMinorUnits as priceMinorUnits",
        "Unit.currency as currency",
        "Unit.investorId as investorId",
        "Project.id as projectId",
        "Project.name as projectName",
        "Project.city as city",
        "Project.country as country"
      ])
      .where("Unit.id", "=", req.params.id)
      .executeTakeFirst();

    if (!unidad) return res.status(404).json({ message: "Unit not found" });

    // **Aislamiento cross-rol** (M2-D1 §Cross-role data isolation): el investor
    // ve SU unidad y ninguna otra.
    if (req.user!.role !== "admin" && unidad.investorId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Los stages son del proyecto, con su estado de anclaje: esto alimenta los
    // StageChips del patrón P9.
    const stages = await db
      .selectFrom("Stage")
      .leftJoin("EvidenceBundle", "EvidenceBundle.stageId", "Stage.id")
      .leftJoin("OnChainEvent", (join) =>
        join
          .onRef("OnChainEvent.stageId", "=", "Stage.id")
          .on("OnChainEvent.eventType", "=", "STAGE_TRANSITION")
          .on("OnChainEvent.toState", "=", "Completed")
      )
      .select([
        "Stage.id as stageId",
        "Stage.name as name",
        "Stage.sequenceOrder as sequenceOrder",
        "Stage.state as state",
        "EvidenceBundle.id as bundleId",
        "OnChainEvent.txid as txid"
      ])
      .where("Stage.projectId", "=", unidad.projectId)
      .orderBy("Stage.sequenceOrder", "asc")
      .execute();

    return res.json({ ...unidad, stages });
  }
);

/** Fila 15-18 — las novedades de la unidad: los eventos de sus stages. */
router.get(
  "/units/:id/news",
  requireRole("admin", "buyer"),
  async (req: Request<{ id: string }>, res) => {
    const unidad = await db
      .selectFrom("Unit")
      .select(["id", "projectId", "investorId"])
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!unidad) return res.status(404).json({ message: "Unit not found" });
    if (req.user!.role !== "admin" && unidad.investorId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const eventos = await db
      .selectFrom("OnChainEvent")
      .leftJoin("Stage", "Stage.id", "OnChainEvent.stageId")
      .select([
        "OnChainEvent.id as id",
        "OnChainEvent.eventType as eventType",
        "OnChainEvent.toState as toState",
        "OnChainEvent.txid as txid",
        "OnChainEvent.status as status",
        "OnChainEvent.createdAt as createdAt",
        "Stage.name as stageName"
      ])
      .where("OnChainEvent.projectId", "=", unidad.projectId)
      .orderBy("OnChainEvent.createdAt", "desc")
      .limit(50)
      .execute();

    return res.json(eventos);
  }
);

/** Fila 26-29 — el dossier compilado, con su hash maestro. */
router.get("/units/:id/dossier", async (req: Request<{ id: string }>, res) => {
  const resultado = await dossierDeLaUnidad(req.params.id, req.user!);
  if (resultado.error === 404) return res.status(404).json({ message: "Unit not found" });
  if (resultado.error === 403) return res.status(403).json({ message: "Forbidden" });

  const { investorId: _investorId, ...dossier } = resultado.dossier;
  return res.json(dossier);
});

/**
 * Fila 26-29 — el export. El PDF es una TRANSCRIPCIÓN del dossier, no una
 * prueba nueva: lleva los mismos hashes y los mismos TXID, completos (regla
 * 16), para que quien lo reciba pueda verificarlos contra el explorer por su
 * cuenta. Un artefacto que dijera "verificado" sin traer con qué comprobarlo
 * sería exactamente lo que D-026 prohíbe.
 */
router.get("/units/:id/dossier/export.pdf", async (req: Request<{ id: string }>, res) => {
  const resultado = await dossierDeLaUnidad(req.params.id, req.user!);
  if (resultado.error === 404) return res.status(404).json({ message: "Unit not found" });
  if (resultado.error === 403) return res.status(403).json({ message: "Forbidden" });

  const d = resultado.dossier;
  const pdf = renderTextPdf([
    "PropNexus - Proof dossier",
    "",
    `Project:      ${d.projectName}`,
    `Unit:         ${d.unitReference}`,
    `Compiled at:  ${d.compiledAt.toISOString()}`,
    `Status:       ${d.status}`,
    `Master hash:  ${d.masterHash}`,
    `Notary TXID:  ${d.signatureTxid ?? "(pending)"}`,
    `Completeness: ${d.completeness}% of artifacts have an on-chain reference`,
    "",
    "This document asserts only that these hashes were registered at these times,",
    "and, where a signature TXID is present, that a notary attested to reviewing them.",
    "It certifies nothing about the construction itself.",
    "",
    "Artifacts",
    "---------",
    ...d.artifacts.flatMap((a) => [
      `[${a.kind}] ${a.label}`,
      `  sha256: ${a.sha256 ?? "(none)"}`,
      `  txid:   ${a.txid ?? "(pending)"}`
    ])
  ]);

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "EXPORT_DOSSIER",
    entityType: "Dossier",
    entityId: d.id,
    metadata: { masterHash: d.masterHash }
  });

  res.setHeader("Content-Type", "application/pdf");
  // El nombre lleva la ref de la unidad, que no es PII. Nunca el nombre del
  // investor.
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="dossier-${d.unitReference.replace(/[^\w.-]/g, "_")}.pdf"`
  );
  return res.send(pdf);
});

/**
 * Fila 28s — compartir. El token es opaco y de 256 bits: es la única
 * credencial del link público, así que no puede derivarse del id de la unidad
 * ni de nada adivinable.
 *
 * **Idempotente** (regla 8): volver a compartir devuelve el MISMO token en vez
 * de invalidar el link que ya se mandó por mail.
 */
router.post("/units/:id/dossier/share", async (req: Request<{ id: string }>, res) => {
  const resultado = await dossierDeLaUnidad(req.params.id, req.user!);
  if (resultado.error === 404) return res.status(404).json({ message: "Unit not found" });
  if (resultado.error === 403) return res.status(403).json({ message: "Forbidden" });

  const d = resultado.dossier;

  const fila = await db
    .selectFrom("Dossier")
    .select("shareToken")
    .where("id", "=", d.id)
    .executeTakeFirstOrThrow();

  let token = fila.shareToken;
  if (!token) {
    token = randomBytes(32).toString("hex");
    await db.updateTable("Dossier").set({ shareToken: token }).where("id", "=", d.id).execute();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "SHARE_DOSSIER",
      entityType: "Dossier",
      entityId: d.id
    });
  }

  // Path sin host: el cliente lo compone con su propio origen. La API no
  // sabe —ni debe saber— bajo qué dominio se sirve el front.
  return res.status(201).json({
    shareToken: token,
    path: `/api/v1/public/dossier/${token}`,
    masterHash: d.masterHash
  } satisfies DossierShare);
});

/**
 * El listado (filas 22 y 62). `unitId` y `category` son los dos filtros que
 * dibujan las `FilterPill` de la captura 22.
 *
 * Un filtro inválido es 400 y no un listado vacío: quien filtra por una
 * categoría que no existe tiene que enterarse, no ver "no hay novedades".
 */
router.get("/notifications", async (req, res) => {
  const filtros = notificationQuerySchema.safeParse(req.query);
  if (!filtros.success) return res.status(400).json(filtros.error.flatten());

  let query = db
    .selectFrom("Notification")
    .select(["id", "category", "titleKey", "paramsJson", "unitId", "readAt", "createdAt"])
    .where("userId", "=", req.user!.id);

  if (filtros.data.unitId) query = query.where("unitId", "=", filtros.data.unitId);
  if (filtros.data.category) query = query.where("category", "=", filtros.data.category);

  const filas = await query.orderBy("createdAt", "desc").limit(100).execute();

  const notificaciones = filas.map((fila) => ({
    id: fila.id,
    category: fila.category,
    titleKey: fila.titleKey,
    params: fila.paramsJson ? JSON.parse(fila.paramsJson) : {},
    unitId: fila.unitId,
    readAt: fila.readAt,
    createdAt: fila.createdAt
  })) as Notification[];

  return res.json(notificaciones);
});

/** Fila 63 — el investor ve la invitación que le llegó. */
router.get(
  "/invitations/:id",
  requireRole("admin", "buyer"),
  async (req: Request<{ id: string }>, res) => {
    const invitacion = await db
      .selectFrom("Invitation")
      .innerJoin("Unit", "Unit.id", "Invitation.unitId")
      .innerJoin("Project", "Project.id", "Invitation.projectId")
      .select([
        "Invitation.id as id",
        "Invitation.investorEmail as investorEmail",
        "Invitation.amountMinorUnits as amountMinorUnits",
        "Invitation.currency as currency",
        "Invitation.status as status",
        "Invitation.createdAt as createdAt",
        "Unit.unitReference as unitReference",
        "Project.name as projectName"
      ])
      .where("Invitation.id", "=", req.params.id)
      .executeTakeFirst();

    if (!invitacion) return res.status(404).json({ message: "Invitation not found" });

    // La invitación es para quien tiene ese email: nadie más la ve.
    if (req.user!.role !== "admin" && invitacion.investorEmail !== req.user!.email) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(invitacion);
  }
);

/** Fila 63 — aceptar. **Ancla** (M3-SC-01). */
router.post(
  "/invitations/:id/accept",
  requireRole("admin", "buyer"),
  async (req: Request<{ id: string }>, res) => {
    const invitacion = await db
      .selectFrom("Invitation")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!invitacion) return res.status(404).json({ message: "Invitation not found" });
    if (req.user!.role !== "admin" && invitacion.investorEmail !== req.user!.email) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (invitacion.status !== "pending") {
      return res.status(409).json({
        message: `Invitation already ${invitacion.status}`,
        code: "INVITATION_NOT_PENDING"
      });
    }

    const ahora = new Date();

    await db
      .updateTable("Invitation")
      .set({ status: "accepted", respondedAt: ahora })
      .where("id", "=", invitacion.id)
      .execute();

    await db
      .updateTable("Unit")
      .set({ status: "sold", investorId: req.user!.id, updatedAt: ahora })
      .where("id", "=", invitacion.unitId)
      .execute();

    // El contrato nace de la aceptación: es el registro del acuerdo, sin
    // custodiar un centavo (D-021).
    const contrato = await db
      .insertInto("Contract")
      .values({
        id: createId(),
        unitId: invitacion.unitId,
        investorId: req.user!.id,
        totalMinorUnits: invitacion.amountMinorUnits,
        currency: invitacion.currency,
        signedAt: ahora,
        createdAt: ahora
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Se ancla el commitment del evento, no sus datos: ni el email ni el monto
    // van a la cadena (regla 2).
    const anchor = await anchorCommitmentEvent({
      projectId: invitacion.projectId,
      eventType: "INVITATION_ACCEPTED",
      commitment: commitmentOf({
        invitationId: invitacion.id,
        unitId: invitacion.unitId,
        acceptedAt: ahora.toISOString()
      }),
      reference: invitacion.id
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "ACCEPT_INVITATION",
      entityType: "Invitation",
      entityId: invitacion.id,
      metadata: { txid: anchor.txid }
    });

    return res.status(201).json({ contract: contrato, anchor });
  }
);

/** Fila 63 — rechazar. **No ancla**: no hay nada que probar sobre lo que no pasó. */
router.post(
  "/invitations/:id/decline",
  requireRole("admin", "buyer"),
  async (req: Request<{ id: string }>, res) => {
    const invitacion = await db
      .selectFrom("Invitation")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!invitacion) return res.status(404).json({ message: "Invitation not found" });
    if (req.user!.role !== "admin" && invitacion.investorEmail !== req.user!.email) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (invitacion.status !== "pending") {
      return res.status(409).json({ message: `Invitation already ${invitacion.status}` });
    }

    const ahora = new Date();
    await db
      .updateTable("Invitation")
      .set({ status: "declined", respondedAt: ahora })
      .where("id", "=", invitacion.id)
      .execute();

    // La unidad vuelve a estar disponible.
    await db
      .updateTable("Unit")
      .set({ status: "available", updatedAt: ahora })
      .where("id", "=", invitacion.unitId)
      .execute();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "DECLINE_INVITATION",
      entityType: "Invitation",
      entityId: invitacion.id
    });

    return res.status(204).send();
  }
);

/** Fila 23-24 — el contrato de la unidad del investor. */
router.get(
  "/contracts/:unitId",
  requireRole("admin", "buyer"),
  async (req: Request<{ unitId: string }>, res) => {
    const contrato = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select([
        "Contract.id as id",
        "Contract.totalMinorUnits as totalMinorUnits",
        "Contract.currency as currency",
        "Contract.signedAt as signedAt",
        "Contract.investorId as investorId",
        "Unit.unitReference as unitReference"
      ])
      .where("Contract.unitId", "=", req.params.unitId)
      .executeTakeFirst();

    if (!contrato) return res.status(404).json({ message: "Contract not found" });
    if (req.user!.role !== "admin" && contrato.investorId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(contrato);
  }
);

export default router;
