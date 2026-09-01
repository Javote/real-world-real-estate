import { createHash } from "node:crypto";
import { merkleProof } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { reconciliarAnclajes, reconciliarParaLectura } from "../domain/reconcile";
import { anchorPort } from "../lib/anchor";
import { db } from "../lib/db";
import { storage } from "../lib/storage";
import {
  ANY_MEMBERSHIP,
  authenticate,
  requireProjectAccess,
  requireRole
} from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared";

const router = Router();

router.use(authenticate);

router.get(
  "/:id",
  requireProjectAccess({ via: "Evidence", param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    const [project, stage, uploadedBy] = await Promise.all([
      db.selectFrom("Project").selectAll().where("id", "=", evidence.projectId).executeTakeFirst(),
      evidence.stageId
        ? db.selectFrom("Stage").selectAll().where("id", "=", evidence.stageId).executeTakeFirst()
        : Promise.resolve(null),
      db
        .selectFrom("User")
        .select(["id", "email", "fullName"])
        .where("id", "=", evidence.uploadedById)
        .executeTakeFirst()
    ]);

    return res.json({ ...evidence, project, stage, uploadedBy });
  }
);

router.get(
  "/:id/download",
  requireProjectAccess({ via: "Evidence", param: "id" }, ANY_MEMBERSHIP),
  async (req, res) => {
    const evidence = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    if (!(await storage.exists(evidence.storagePath))) {
      return res.status(404).json({ message: "Stored file not found" });
    }

    // Se streamea desde el storage en vez de `res.download`: con `s3` no hay
    // ruta local que pasarle, y el nombre visible sale del registro, no del
    // objeto guardado.
    res.setHeader("Content-Type", evidence.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(evidence.originalFilename)}"`
    );
    const contenido = await storage.read(evidence.storagePath);
    return contenido.pipe(res);
  }
);

router.patch(
  "/:id",
  requireRole("admin", "developer"),
  requireProjectAccess({ via: "Evidence", param: "id" }, ["developer"]),
  async (req: Request<{ id: string }>, res) => {
    const existing = await db
      .selectFrom("Evidence")
      .selectAll()
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!existing) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    const schema = z.object({
      category: z.string().min(1).optional(),
      authoritative: z.boolean().optional(),
      evidenceType: z.enum(["document", "photo", "certificate"]).optional(),
      stageId: z.string().nullable().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error.flatten());
    }

    if (parsed.data.stageId) {
      const stage = await db
        .selectFrom("Stage")
        .select("id")
        .where("id", "=", parsed.data.stageId)
        .where("projectId", "=", existing.projectId)
        .executeTakeFirst();

      if (!stage) {
        return res.status(400).json({
          message: "Stage does not belong to project"
        });
      }
    }

    await db
      .updateTable("Evidence")
      .set({ ...parsed.data, updatedAt: new Date() })
      .where("id", "=", req.params.id)
      .execute();

    const evidence = await db
      .selectFrom("Evidence")
      .select(EVIDENCE_SAFE_COLUMNS)
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "UPDATE_EVIDENCE",
      entityType: "Evidence",
      entityId: req.params.id
    });

    return res.json(evidence);
  }
);

/**
 * **Anclar el hash de un archivo. Lo dispara el admin, nunca el upload** (D-061).
 *
 * Es el camino `Evidence Anchor Transactions` de `M1-D2/1-system-architecture`:
 * metadata suelta (label 1904, D-006), sin validador. Prueba *este archivo
 * existía a esta hora* — no que un stage avanzó, que es lo que prueba el hilo.
 *
 * Por qué manual: una vez en la cadena no se borra. Anclar en el upload
 * anclaría borradores, archivos subidos por error y versiones que todavía no
 * son la buena. Y M2-D4 §6.3 pide que toda superficie de prueba la inicie el
 * usuario.
 *
 * Idempotente (regla 8): si ese archivo ya tiene su anclaje, devuelve el mismo
 * evento en vez de gastar otra transacción.
 */
/**
 * `POST /api/v1/evidence/reconcile` — promueve a `Confirmed` los anclajes que
 * ya entraron en un bloque (SPEC-013 §C).
 *
 * **Va antes de `/:id/anchor` a propósito:** Express matchea por orden, y
 * `"reconcile"` encajaría en `:id` si se declarara después. El síntoma sería un
 * 404 buscando una evidencia con id "reconcile".
 *
 * Sin body y sin parámetros: revisa lo que haya pendiente. Es idempotente por
 * construcción —un evento ya confirmado no vuelve a consultarse— así que
 * dispararlo de más no cuesta nada.
 *
 * Lo dispara alguien de afuera: hoy a mano, mañana un cron de GitHub Actions.
 * **Nunca un `setInterval` acá adentro** (D-003 · D-040): con el servicio
 * dormido a los 15 minutos, un timer interno deja de contar y nadie se entera.
 */
router.post("/reconcile", requireRole("admin"), async (_req, res) => {
  res.json(await reconciliarAnclajes());
});

router.post(
  "/:id/anchor",
  requireRole("admin"),
  requireProjectAccess({ via: "Evidence", param: "id" }, ANY_MEMBERSHIP),
  async (req: Request<{ id: string }>, res) => {
    const evidencia = await db
      .selectFrom("Evidence")
      .select(["id", "projectId", "stageId", "sha256Hash"])
      .where("id", "=", req.params.id)
      .executeTakeFirst();

    if (!evidencia) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    // Si ya está anclada, la respuesta es ese evento: se confirma antes de
    // devolverlo, para no contestar "Pendiente" sobre algo que ya está en un
    // bloque (D-077).
    await reconciliarParaLectura({ evidenceId: evidencia.id });

    const yaAnclada = await db
      .selectFrom("OnChainEvent")
      .selectAll()
      .where("evidenceId", "=", evidencia.id)
      .where("txid", "is not", null)
      .executeTakeFirst();

    if (yaAnclada) {
      return res.status(200).json(yaAnclada);
    }

    const previo = await db
      .selectFrom("OnChainEvent")
      .select("eventIndex")
      .where("stageId", "=", evidencia.stageId)
      .orderBy("eventIndex", "desc")
      .limit(1)
      .executeTakeFirst();

    const now = new Date();
    const evento = await db
      .insertInto("OnChainEvent")
      .values({
        id: createId(),
        projectId: evidencia.projectId,
        stageId: evidencia.stageId,
        evidenceId: evidencia.id,
        eventIndex: previo ? previo.eventIndex + 1 : 0,
        eventType: "EVIDENCE_ANCHOR",
        fromState: null,
        toState: null,
        commitment: evidencia.sha256Hash,
        status: "Pending",
        txid: null,
        outputRef: null,
        blockTimestamp: null,
        createdAt: now,
        updatedAt: now
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    let anclado = evento;
    try {
      const recibo = await anchorPort().anchorCommitment({
        sha256: evidencia.sha256Hash,
        // Ref opaca: el id del registro, nunca el nombre del archivo (regla 2).
        reference: evidencia.id
      });

      anclado = await db
        .updateTable("OnChainEvent")
        .set({ txid: recibo.txid, status: recibo.status, updatedAt: new Date() })
        .where("id", "=", evento.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (error) {
      console.error("[anchor] el anclaje de evidencia falló", { evidenceId: evidencia.id, error });
      anclado = await db
        .updateTable("OnChainEvent")
        .set({ status: "Failed", updatedAt: new Date() })
        .where("id", "=", evento.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "ANCHOR_EVIDENCE",
      entityType: "Evidence",
      entityId: evidencia.id,
      metadata: { txid: anclado.txid, status: anclado.status }
    });

    return res.status(201).json(anclado);
  }
);

router.delete("/:id", requireRole("admin"), async (req: Request<{ id: string }>, res) => {
  const existing = await db
    .selectFrom("Evidence")
    .selectAll()
    .where("id", "=", req.params.id)
    .executeTakeFirst();

  if (!existing) {
    return res.status(404).json({ message: "Evidence not found" });
  }

  await storage.remove(existing.storagePath);

  await db.deleteFrom("Evidence").where("id", "=", req.params.id).execute();

  await writeAuditLog({
    actorUserId: req.user!.id,
    action: "DELETE_EVIDENCE",
    entityType: "Evidence",
    entityId: req.params.id
  });

  return res.status(204).send();
});

/**
 * Fila 25m — el camino de Merkle de un archivo dentro de su bundle.
 *
 * Es lo que vuelve real la promesa de M2-D4 P5: el revisor rehashea **su**
 * archivo, camina el árbol con estos hermanos y compara con la raíz anclada.
 * Sin esto, tendría que bajarse todos los archivos del bundle.
 */
router.get("/:bundleId/proof/:fileHash", async (req, res) => {
  const items = await db
    .selectFrom("EvidenceBundleItem")
    .select(["sha256Hash"])
    .where("bundleId", "=", req.params.bundleId as string)
    .execute();

  if (items.length === 0) return res.status(404).json({ message: "Bundle not found" });

  const bundle = await db
    .selectFrom("EvidenceBundle")
    .select(["commitmentHash"])
    .where("id", "=", req.params.bundleId as string)
    .executeTakeFirstOrThrow();

  const sha256Pair = (a: string, b: string) =>
    createHash("sha256")
      .update(Buffer.from(a + b, "hex"))
      .digest("hex");

  try {
    const proof = merkleProof(
      items.map((i) => i.sha256Hash),
      req.params.fileHash as string,
      sha256Pair
    );
    return res.json({ merkleRoot: bundle.commitmentHash, leaf: req.params.fileHash, proof });
  } catch {
    return res.status(404).json({ message: "That hash is not part of this bundle" });
  }
});

/** Fila 25m — los archivos del bundle con sus hashes. */
router.get("/:bundleId/files", async (req, res) => {
  const bundle = await db
    .selectFrom("EvidenceBundle")
    .selectAll()
    .where("id", "=", req.params.bundleId as string)
    .executeTakeFirst();

  if (!bundle) return res.status(404).json({ message: "Bundle not found" });

  const items = await db
    .selectFrom("EvidenceBundleItem")
    .leftJoin("Evidence", "Evidence.id", "EvidenceBundleItem.evidenceId")
    .select([
      "EvidenceBundleItem.evidenceId as evidenceId",
      "EvidenceBundleItem.sha256Hash as sha256Hash",
      "Evidence.originalFilename as filename"
    ])
    .where("EvidenceBundleItem.bundleId", "=", bundle.id)
    .execute();

  return res.json({ bundleId: bundle.id, merkleRoot: bundle.commitmentHash, files: items });
});

export default router;
