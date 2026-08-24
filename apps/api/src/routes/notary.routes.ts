import type { NotarySignature } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { compileDossier } from "../domain/dossier";
import { notifyUnitInvestor } from "../domain/notify";
import { db } from "../lib/db";
import { authenticate, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";

// El flujo del notario (M2-D5 filas 52v, 52s, 52r, 53) — **M3-BE-17** y
// **M3-SC-04**.
//
// **Lo único que la firma afirma** (D-026): que esta persona atestiguó haber
// revisado estos hashes en este momento. No dice que los documentos sean
// auténticos, ni que la obra esté bien, ni que la operación sea válida. El copy
// y el datum tienen que sostener exactamente eso y nada más.
//
// **Lo que se ancla es el `masterHash`, no el dossier.** El contenido del
// dossier nombra unidades y personas: nada de eso puede ir a la cadena (regla
// 2). El commitment compromete el hash maestro y el id opaco del dossier.
//
// El notario NO tiene membresía por proyecto: revisa dossiers de cualquier
// proyecto. Por eso acá la autorización es `requireRole` sola y no las dos
// capas — es la excepción que M2-D1 §4 declara para el rol, no un olvido.

const router = Router();

router.use(authenticate);
router.use(requireRole("admin", "notary"));

/** Fila 52v — el dossier a revisar, completo, con la huella de cada pieza. */
router.get("/dossiers/:id", async (req: Request<{ id: string }>, res) => {
  const fila = await db
    .selectFrom("Dossier")
    .select("unitId")
    .where("id", "=", req.params.id)
    .executeTakeFirst();

  if (!fila) return res.status(404).json({ message: "Dossier not found" });

  const dossier = await compileDossier(fila.unitId);
  if (!dossier) return res.status(404).json({ message: "Dossier not found" });

  const { investorId: _investorId, ...publico } = dossier;
  return res.json(publico);
});

/**
 * Fila 52s — firmar. **Ancla** (M3-SC-04).
 *
 * El `masterHash` que se firma se congela: a partir de acá `compileDossier`
 * deja de recomputarlo, porque una firma que apunte a un hash que ya cambió no
 * prueba nada.
 *
 * **Idempotente** (regla 8): firmar dos veces devuelve la misma firma en vez de
 * gastar otra transacción y dejar dos atestiguaciones del mismo hecho.
 */
router.post("/dossiers/:id/sign", async (req: Request<{ id: string }>, res) => {
  const fila = await db
    .selectFrom("Dossier")
    .selectAll()
    .where("id", "=", req.params.id)
    .executeTakeFirst();

  if (!fila) return res.status(404).json({ message: "Dossier not found" });

  if (fila.status === "signed") {
    const anterior = await db
      .selectFrom("OnChainEvent")
      .selectAll()
      .where("referenceId", "=", fila.id)
      .where("eventType", "=", "DOSSIER_SIGNATURE")
      .executeTakeFirst();

    return res
      .status(200)
      .json({ dossierId: fila.id, masterHash: fila.masterHash, anchor: anterior });
  }

  // Se firma el estado ACTUAL, recompilado ahora: firmar el hash guardado
  // sería atestiguar sobre una foto vieja.
  const dossier = await compileDossier(fila.unitId);
  if (!dossier) return res.status(404).json({ message: "Dossier not found" });

  const ahora = new Date();

  await db
    .updateTable("Dossier")
    .set({
      status: "signed",
      masterHash: dossier.masterHash,
      signedById: req.user!.id,
      signedAt: ahora,
      rejectionNote: null
    })
    .where("id", "=", fila.id)
    .execute();

  const anchor = await anchorCommitmentEvent({
    projectId: dossier.projectId,
    eventType: "DOSSIER_SIGNATURE",
    commitment: commitmentOf({
      dossierId: dossier.id,
      masterHash: dossier.masterHash,
      signedAt: ahora.toISOString()
    }),
    reference: dossier.id
  });

  await notifyUnitInvestor({
    unitId: dossier.unitId,
    category: "signature",
    titleKey: "notifications.dossier.signed",
    params: { unitReference: dossier.unitReference }
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "SIGN_DOSSIER",
    entityType: "Dossier",
    entityId: dossier.id,
    metadata: { masterHash: dossier.masterHash, txid: anchor.txid }
  });

  return res.status(201).json({
    dossierId: dossier.id,
    masterHash: dossier.masterHash,
    signedAt: ahora,
    anchor
  });
});

/**
 * Fila 52r — rechazar. **No ancla**: un rechazo es una observación off-chain, y
 * su texto puede nombrar personas (regla 2). Queda en el `AuditLog` y en la
 * nota del dossier, que es donde el developer lo lee.
 *
 * Un dossier firmado no se rechaza: la atestiguación ya ocurrió y borrarla
 * sería reescribir un hecho.
 */
router.post("/dossiers/:id/reject", async (req: Request<{ id: string }>, res) => {
  const schema = z.strictObject({ note: z.string().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const fila = await db
    .selectFrom("Dossier")
    .selectAll()
    .where("id", "=", req.params.id)
    .executeTakeFirst();

  if (!fila) return res.status(404).json({ message: "Dossier not found" });
  if (fila.status === "signed") {
    return res.status(409).json({ message: "Dossier already signed", code: "DOSSIER_SIGNED" });
  }

  await db
    .updateTable("Dossier")
    .set({ status: "rejected", rejectionNote: parsed.data.note })
    .where("id", "=", fila.id)
    .execute();

  await notifyUnitInvestor({
    unitId: fila.unitId,
    category: "signature",
    titleKey: "notifications.dossier.rejected"
  });

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "REJECT_DOSSIER",
    entityType: "Dossier",
    entityId: fila.id,
    metadata: { note: parsed.data.note }
  });

  // 200 y no 201: rechazar no crea nada. La firma sí crea un evento anclado y
  // por eso contesta 201; el rechazo solo cambia el estado de algo que ya
  // existía.
  return res.status(200).json({ dossierId: fila.id, status: "rejected" });
});

/** Fila 53 — el historial de lo firmado, paginado por cursor. */
router.get("/signatures", async (req, res) => {
  const schema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  let query = db
    .selectFrom("Dossier")
    .innerJoin("Unit", "Unit.id", "Dossier.unitId")
    .innerJoin("Project", "Project.id", "Unit.projectId")
    .leftJoin("OnChainEvent", (join) =>
      join
        .onRef("OnChainEvent.referenceId", "=", "Dossier.id")
        .on("OnChainEvent.eventType", "=", "DOSSIER_SIGNATURE")
    )
    .select([
      "Dossier.id as dossierId",
      "Dossier.masterHash as masterHash",
      "Dossier.status as status",
      "Dossier.signedAt as signedAt",
      "Unit.unitReference as unitReference",
      "Project.name as projectName",
      "OnChainEvent.txid as signatureTxid"
    ])
    .where("Dossier.status", "=", "signed")
    .orderBy("Dossier.signedAt", "desc")
    .limit(parsed.data.limit);

  // Un admin ve todo; un notario, lo que firmó él.
  if (req.user!.role !== "admin") {
    query = query.where("Dossier.signedById", "=", req.user!.id);
  }
  if (parsed.data.cursor) {
    query = query.where("Dossier.signedAt", "<", new Date(parsed.data.cursor));
  }

  const filas = await query.execute();
  const items = filas.map((f) => ({
    dossierId: f.dossierId,
    unitReference: f.unitReference,
    projectName: f.projectName,
    masterHash: f.masterHash,
    signatureTxid: f.signatureTxid,
    signedAt: f.signedAt ? new Date(f.signedAt) : null,
    status: f.status
  })) as NotarySignature[];

  const ultima = items.at(-1);

  return res.json({
    items,
    nextCursor: ultima?.signedAt ? ultima.signedAt.toISOString() : null
  });
});

export default router;
