import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { db } from "../lib/db";
import { authenticate, requireProjectAccess, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

// Invitaciones (M2-D5 filas 39, 63) — **M3-SC-01**.
//
// El developer invita a un investor a una unidad; el investor acepta o rechaza.
// **Aceptar ancla** (M2-D5 anota "→ TXID"): es el primer commitment del ciclo
// comercial. Rechazar no ancla — no hay nada que probar sobre algo que no pasó.
//
// Lo que se ancla es el COMMITMENT del evento, no sus datos: el email del
// investor y el monto no pueden terminar en la cadena (regla 2).

const router = Router();

router.use(authenticate);

/** Fila 39 — el developer emite la invitación. */
router.post(
  "/developer/projects/:id/invitations",
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

/** Fila 63 — el investor ve la invitación que le llegó. */
router.get(
  "/investor/invitations/:id",
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
  "/investor/invitations/:id/accept",
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
  "/investor/invitations/:id/decline",
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

export default router;
