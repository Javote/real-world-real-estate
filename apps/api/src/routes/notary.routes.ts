import type { NotaryKpis, NotarySignature, PendingDossier } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { anchorCommitmentEvent, commitmentOf } from "../domain/anchoring";
import { compileDossier } from "../domain/dossier";
import { notifyUnitInvestor } from "../domain/notify";
import { reconciliarParaLectura } from "../domain/reconcile";
import { db } from "../lib/db";
import { authenticate, authorize } from "../middlewares/auth";
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
// proyecto. Por eso acá el `acceso` de todas las rutas es `"soloRol"` — es la
// excepción que M2-D1 §4 declara para el rol, no un olvido.
//
// **Y las rutas de `/dossiers/:id` tampoco tienen regla de pertenencia**, que es
// lo que uno esperaría de una ruta con `:id`: el dossier pendiente es una **cola
// de trabajo compartida** y cualquier notary firma cualquiera; `signedById` se
// escribe recién al firmar. Lo que hacen `/kpis` y `/signatures` con esa columna
// es acotar la vista, que es scope y no autorización. Se verificó al migrar
// (2026-09-04): si algún día el dossier se asigna a un notary, esto pasa a ser
// `{ dueño: ... }` y deja de ser `"soloRol"`.

const router = Router();

router.use(authenticate);

/**
 * Fila 51 — los KPI del notario. **Ya no son `null`.**
 *
 * Lo eran mientras el dossier no existía como entidad: `null` decía "no hay
 * modelo" y cero habría dicho "no tenés trabajo", que es una afirmación
 * distinta. Ahora `Dossier` existe y los cuatro se cuentan de verdad — el
 * schema los sigue aceptando nullable porque la distinción vale para los KPI
 * del developer que todavía no se pueden calcular.
 */
router.get(
  "/kpis",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  async (req, res) => {
    const filas = await db
      .selectFrom("Dossier")
      .select(["id", "status", "signedById", "unitId"])
      .execute();

    // Un admin ve el total; un notario, lo que firmó él más la cola común.
    const firmados = filas.filter(
      (f) => f.status === "signed" && (req.user!.role === "admin" || f.signedById === req.user!.id)
    );
    const pendientes = filas.filter((f) => f.status === "compiled");

    const kpis: NotaryKpis = {
      pendingDossiers: pendientes.length,
      // "Verificado" acá es el dossier revisado y resuelto: firmado o rechazado.
      // No afirma nada sobre la obra (D-026).
      verified: filas.filter((f) => f.status !== "compiled").length,
      signed: firmados.length,
      unitsUnderReview: new Set(pendientes.map((f) => f.unitId)).size
    };
    return res.json(kpis);
  }
);

/**
 * Fila 51 — la cola de revisión, con la barra de completitud.
 *
 * `completeness` es **qué fracción de la evidencia del dossier tiene su prueba
 * sustanciada**, no "cuán listo está": un dossier al 60% tiene el 40% de sus
 * artefactos todavía sin TXID (regla 17).
 */
router.get(
  "/dossiers/pending",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  async (_req, res) => {
    const filas = await db
      .selectFrom("Dossier")
      .innerJoin("Unit", "Unit.id", "Dossier.unitId")
      .leftJoin("User", "User.id", "Unit.investorId")
      .select([
        "Dossier.id as dossierId",
        "Dossier.unitId as unitId",
        "Unit.unitReference as unitReference",
        "User.fullName as investorName"
      ])
      .where("Dossier.status", "=", "compiled")
      .orderBy("Dossier.compiledAt", "asc")
      .limit(50)
      .execute();

    const pendientes: PendingDossier[] = [];
    for (const fila of filas) {
      const dossier = await compileDossier(fila.unitId);
      pendientes.push({
        dossierId: fila.dossierId,
        unitLabel: fila.unitReference,
        // Sin investor asignado la unidad no se vendió todavía; el panel muestra
        // la referencia de la unidad y no un nombre inventado.
        investorName: fila.investorName ?? fila.unitReference,
        completeness: dossier?.completeness ?? 0
      });
    }

    return res.json(pendientes);
  }
);

/** Fila 52v — el dossier a revisar, completo, con la huella de cada pieza. */
router.get(
  "/dossiers/:id",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  async (req: Request<{ id: string }>, res) => {
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
  }
);

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
router.post(
  "/dossiers/:id/sign",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  async (req: Request<{ id: string }>, res) => {
    const fila = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!fila) return res.status(404).json({ message: "Dossier not found" });

    if (fila.status === "signed") {
      await reconciliarParaLectura({ referenceId: fila.id });

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
  }
);

/**
 * Fila 52r — rechazar. **No ancla**: un rechazo es una observación off-chain, y
 * su texto puede nombrar personas (regla 2). Queda en el `AuditLog` y en la
 * nota del dossier, que es donde el developer lo lee.
 *
 * Un dossier firmado no se rechaza: la atestiguación ya ocurrió y borrarla
 * sería reescribir un hecho.
 */
router.post(
  "/dossiers/:id/reject",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  async (req: Request<{ id: string }>, res) => {
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
  }
);

/** Fila 53 — el historial de lo firmado, paginado por cursor. */
router.get(
  "/signatures",
  authorize({ roles: ["admin", "notary"], acceso: "soloRol" }),
  async (req, res) => {
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
  }
);

export default router;
