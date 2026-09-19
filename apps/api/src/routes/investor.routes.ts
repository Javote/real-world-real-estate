import { randomBytes } from "node:crypto";
import {
  acceptInvitationResultSchema,
  cuidParamSchema,
  dossierSchema,
  dossierShareSchema,
  investorContractSchema,
  investorInvitationDetailSchema,
  investorUnitDetailSchema,
  investorUnitListItemSchema,
  notificationQuerySchema,
  notificationSchema,
  projectSchema,
  unitNewsEventSchema
} from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { compileDossier } from "../domain/dossier";
import { reconciliarParaLectura } from "../domain/reconcile";
import { ultimoBundlePorStage } from "../domain/stage-transition";
import { db } from "../lib/db";
import { authenticate, authorize } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
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
// dossier. Ese chequeo es el `acceso: { dueño: ... }` de `authorize` y se lee en
// la firma de cada ruta, junto con el rol. Vivió suelto adentro de cada handler hasta el
// 2026-09-04, con el argumento de que el dato que decide sale de la fila y no
// del token — cierto, y no alcanza: `requireProjectAccess` también carga una
// fila y nadie lo bajó al handler por eso. Lo que traía era el modo de falla de
// siempre: una ruta nueva que se olvida el `if` compila y sirve la unidad ajena.

const router = Router();

/**
 * Rechazo de `accept` con causa (SPEC-201, invariante 4): el 409 que llega al
 * cliente no puede ser el `RESOURCE_ALREADY_EXISTS` genérico que hoy tira el
 * índice único de `Contract.unitId` — tiene que decir qué pasó. Se tira
 * **adentro** de `db.transaction()` a propósito: lanzar es lo único que
 * revierte las escrituras que ya corrieron en esa misma transacción (Kysely
 * comitea en un `return` normal, no solo en el camino feliz).
 */
class InvitationAcceptError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "InvitationAcceptError";
  }
}

router.param("id", paramValidator(cuidParamSchema));
router.param("projectId", paramValidator(cuidParamSchema));
router.param("unitId", paramValidator(cuidParamSchema));

router.use(authenticate);

/**
 * El dossier de la unidad. **Ya no autoriza**: las tres rutas que lo usan entran
 * por `authorize({ ..., acceso: { dueño: { via: "Unit" } } })`, así que acá solo
 * queda el 404 de una
 * unidad que existe pero todavía no compila un dossier.
 */
async function dossierDeLaUnidad(unitId: string) {
  const dossier = await compileDossier(unitId);
  return dossier ? { dossier } : { error: 404 as const };
}

router.get(
  "/favorites",
  authorize({ roles: ["admin", "buyer"], acceso: { scopeEnQuery: "Favorite.userId = usuario" } }),
  async (req, res) => {
    const favoritos = await db
      .selectFrom("Favorite")
      .innerJoin("Project", "Project.id", "Favorite.projectId")
      .selectAll("Project")
      .where("Favorite.userId", "=", req.user!.id)
      .orderBy("Favorite.createdAt", "desc")
      .execute();

    return res.json(z.array(projectSchema).parse(favoritos));
  }
);

router.post(
  "/favorites/:projectId",
  authorize({ roles: ["admin", "buyer"], acceso: "soloRol" }),
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
  authorize({ roles: ["admin", "buyer"], acceso: { scopeEnQuery: "Favorite.userId = usuario" } }),
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
router.get(
  "/units",
  authorize({ roles: ["admin", "buyer"], acceso: { scopeEnQuery: "Unit.investorId = usuario" } }),
  async (req, res) => {
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

    return res.json(
      z
        .array(investorUnitListItemSchema)
        .parse(unidades.map((u) => ({ ...u, progress: avance.get(u.projectId) ?? 0 })))
    );
  }
);

/** Fila 15-18 — el detalle de la unidad, con los stages del proyecto y su anclaje. */
router.get(
  "/units/:id",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
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

    // Los stages son del proyecto, con su estado de anclaje: esto alimenta los
    // StageChips del patrón P9.
    //
    // `ultimoBundlePorStage` (SPEC-213) elige el bundle vigente — un stage
    // acumula uno por cada subida de evidencia antes de completarse, así que
    // un `leftJoin` directo a `EvidenceBundle` duplicaría filas acá.
    const stages = await db
      .selectFrom("Stage")
      .leftJoin(ultimoBundlePorStage, "EvidenceBundle.stageId", "Stage.id")
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

    return res.json(investorUnitDetailSchema.parse({ ...unidad, stages }));
  }
);

/** Fila 15-18 — las novedades de la unidad: los eventos de sus stages. */
router.get(
  "/units/:id/news",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  async (req: Request<{ id: string }>, res) => {
    const unidad = await db
      .selectFrom("Unit")
      .select(["id", "projectId", "investorId"])
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!unidad) return res.status(404).json({ message: "Unit not found" });

    // El anclaje `Pending` que ya está en la cadena se confirma acá, en el
    // momento en que alguien lo mira (D-077).
    await reconciliarParaLectura({ projectId: unidad.projectId });

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

    return res.json(z.array(unitNewsEventSchema).parse(eventos));
  }
);

/** Fila 26-29 — el dossier compilado, con su hash maestro. */
router.get(
  "/units/:id/dossier",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  async (req: Request<{ id: string }>, res) => {
    const resultado = await dossierDeLaUnidad(req.params.id);
    if (resultado.error === 404) return res.status(404).json({ message: "Unit not found" });

    const { investorId: _investorId, ...dossier } = resultado.dossier;
    return res.json(dossierSchema.parse(dossier));
  }
);

/**
 * Fila 26-29 — el export. El PDF es una TRANSCRIPCIÓN del dossier, no una
 * prueba nueva: lleva los mismos hashes y los mismos TXID, completos (regla
 * 16), para que quien lo reciba pueda verificarlos contra el explorer por su
 * cuenta. Un artefacto que dijera "verificado" sin traer con qué comprobarlo
 * sería exactamente lo que D-026 prohíbe.
 */
router.get(
  "/units/:id/dossier/export.pdf",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  async (req: Request<{ id: string }>, res) => {
    const resultado = await dossierDeLaUnidad(req.params.id);
    if (resultado.error === 404) return res.status(404).json({ message: "Unit not found" });

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
  }
);

/**
 * Fila 28s — compartir. El token es opaco y de 256 bits: es la única
 * credencial del link público, así que no puede derivarse del id de la unidad
 * ni de nada adivinable.
 *
 * **Idempotente** (regla 8): volver a compartir devuelve el MISMO token en vez
 * de invalidar el link que ya se mandó por mail.
 */
router.post(
  "/units/:id/dossier/share",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Unit", param: "id" } } }),
  async (req: Request<{ id: string }>, res) => {
    const resultado = await dossierDeLaUnidad(req.params.id);
    if (resultado.error === 404) return res.status(404).json({ message: "Unit not found" });

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
    return res.status(201).json(
      dossierShareSchema.parse({
        shareToken: token,
        path: `/api/v1/public/dossier/${token}`,
        masterHash: d.masterHash
      })
    );
  }
);

/**
 * El listado (filas 22 y 62). `unitId` y `category` son los dos filtros que
 * dibujan las `FilterPill` de la captura 22.
 *
 * Un filtro inválido es 400 y no un listado vacío: quien filtra por una
 * categoría que no existe tiene que enterarse, no ver "no hay novedades".
 */
router.get(
  "/notifications",
  authorize({
    roles: ["admin", "buyer"],
    acceso: { scopeEnQuery: "Notification.userId = usuario" }
  }),
  async (req, res) => {
    const filtros = notificationQuerySchema.safeParse(req.query);
    if (!filtros.success) return res.status(400).json(filtros.error.flatten());

    let query = db
      .selectFrom("Notification")
      .select(["id", "category", "titleKey", "paramsJson", "unitId", "readAt", "createdAt"])
      .where("userId", "=", req.user!.id);

    if (filtros.data.unitId) query = query.where("unitId", "=", filtros.data.unitId);
    if (filtros.data.category) query = query.where("category", "=", filtros.data.category);

    const filas = await query.orderBy("createdAt", "desc").limit(100).execute();

    const notificaciones = z.array(notificationSchema).parse(
      filas.map((fila) => ({
        id: fila.id,
        category: fila.category,
        titleKey: fila.titleKey,
        params: fila.paramsJson ? JSON.parse(fila.paramsJson) : {},
        unitId: fila.unitId,
        readAt: fila.readAt,
        createdAt: fila.createdAt
      }))
    );

    return res.json(notificaciones);
  }
);

/** Fila 63 — el investor ve la invitación que le llegó. */
router.get(
  "/invitations/:id",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Invitation", param: "id" } } }),
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

    return res.json(investorInvitationDetailSchema.parse(invitacion));
  }
);

/** Fila 63 — aceptar. **Ancla** (M3-SC-01). */
router.post(
  "/invitations/:id/accept",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Invitation", param: "id" } } }),
  async (req: Request<{ id: string }>, res) => {
    const ahora = new Date();

    // Las 4 escrituras nacen o mueren juntas (SPEC-201): sin esto, un
    // `INSERT Contract` que choca contra `Contract_unitId_key` dejaba la
    // unidad ya transferida y la membresía ya otorgada, sin contrato — y a
    // quien ya la había comprado se la había sacado en silencio.
    try {
      const { contrato, invitacion } = await db.transaction().execute(async (trx) => {
        const invitacion = await trx
          .selectFrom("Invitation")
          .selectAll()
          .where("id", "=", req.params.id)
          .executeTakeFirst();

        if (!invitacion) {
          throw new InvitationAcceptError(404, "INVITATION_NOT_FOUND", "Invitation not found");
        }

        // Guarda atómica (punto 2): el `WHERE status = 'pending'` hace que solo
        // una de dos requests concurrentes sobre la MISMA invitación gane esta
        // fila — la otra ve `numUpdatedRows = 0` sin haber tenido que leer el
        // estado antes, que es exactamente la ventana que dejaba pasar el
        // `if (invitacion.status !== "pending")` de arriba (invariante 3).
        const actualizada = await trx
          .updateTable("Invitation")
          .set({ status: "accepted", respondedAt: ahora })
          .where("id", "=", invitacion.id)
          .where("status", "=", "pending")
          .executeTakeFirst();

        if (Number(actualizada.numUpdatedRows) === 0) {
          throw new InvitationAcceptError(
            409,
            "INVITATION_NOT_PENDING",
            `Invitation already ${invitacion.status}`
          );
        }

        // Invariante 1: una unidad `sold` no admite invitaciones nuevas. La
        // emisión ya lo impide desde ahora (developer-comercial.routes.ts), pero
        // una invitación `pending` emitida ANTES de ese fix puede seguir
        // existiendo sobre una unidad que otra invitación ya vendió — este
        // chequeo es lo que hace que ese accept falle sin tocar nada más,
        // en vez de chocar recién en el `INSERT Contract` con un
        // `RESOURCE_ALREADY_EXISTS` que no dice qué pasó (invariante 4).
        const unidad = await trx
          .selectFrom("Unit")
          .select(["status"])
          .where("id", "=", invitacion.unitId)
          .executeTakeFirstOrThrow();

        if (unidad.status === "sold") {
          throw new InvitationAcceptError(409, "UNIT_NOT_AVAILABLE", "Unit is no longer available");
        }

        await trx
          .updateTable("Unit")
          .set({ status: "sold", investorId: req.user!.id, updatedAt: ahora })
          .where("id", "=", invitacion.unitId)
          .execute();

        // **La membresía, sin la cual aceptar no sirve de nada.** M2-D1 §4 le da al
        // investor lectura sobre los stages, la evidencia y el contrato del proyecto
        // de su unidad, y el paso 6 del flujo de onboarding dice que después de
        // aceptar ve su unidad "with progress timeline visible". En este código esa
        // lectura se resuelve con membresía por proyecto —`ANY_MEMBERSHIP` incluye
        // `buyer`— y hasta el 2026-09-04 este handler no la creaba: el investor
        // aceptaba y toda ruta con `requireProjectAccess` le contestaba 403,
        // **incluidas las del Merkle proof de su propia evidencia**
        // (`INV-MERKLE-PROOF-002`).
        //
        // `doNothing` por la regla 8: el índice único es
        // (userId, projectId, membershipRole), así que reintentar no duplica.
        await trx
          .insertInto("ProjectMember")
          .values({
            id: createId(),
            userId: req.user!.id,
            projectId: invitacion.projectId,
            membershipRole: "buyer",
            createdAt: ahora
          })
          .onConflict((oc) => oc.doNothing())
          .execute();

        // El contrato nace de la aceptación: es el registro del acuerdo, sin
        // custodiar un centavo (D-021).
        const contrato = await trx
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

        return { contrato, invitacion };
      });

      // El anclaje es una transacción de **Cardano**: no puede ser atómico con
      // la base, y D-059 dice que el registro nunca depende de él. Se ancla
      // después del commit, como antes — si falla, la aceptación queda firme y
      // el evento queda `Pending` para reconciliar.
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
        // La membresía queda en el mismo asiento: es un otorgamiento de permiso
        // y tiene que poder leerse en el audit log, no deducirse.
        metadata: { txid: anchor.txid, membershipRole: "buyer" }
      });

      return res
        .status(201)
        .json(acceptInvitationResultSchema.parse({ contract: contrato, anchor }));
    } catch (err) {
      if (err instanceof InvitationAcceptError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  }
);

/** Fila 63 — rechazar. **No ancla**: no hay nada que probar sobre lo que no pasó. */
router.post(
  "/invitations/:id/decline",
  authorize({ roles: ["admin", "buyer"], acceso: { dueño: { via: "Invitation", param: "id" } } }),
  async (req: Request<{ id: string }>, res) => {
    const invitacion = await db
      .selectFrom("Invitation")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!invitacion) return res.status(404).json({ message: "Invitation not found" });
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
  authorize({
    roles: ["admin", "buyer"],
    acceso: { dueño: { via: "ContractOfUnit", param: "unitId" } }
  }),
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

    return res.json(investorContractSchema.parse(contrato));
  }
);

export default router;
