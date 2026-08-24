import { createHash } from "node:crypto";
import { merkleProof } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { transitionStage } from "../domain/stage-transition";
import { db } from "../lib/db";
import { authenticate, requireProjectAccess, requireRole } from "../middlewares/auth";

// Superficie del certifier (M2-D5 filas 56v, 56c, 57, 58).
//
// **Certificar y observar son transiciones de la misma FSM**, con distinta
// autorización: las dos delegan en `transitionStage`. Si esta ruta escribiera su
// propia versión, la tabla de transiciones existiría dos veces.
//
// Y una precisión de vocabulario que el entregable obliga (D-026): el certifier
// **no certifica validez legal**. Verifica integridad y completitud contra los
// hashes anclados. El endpoint se llama `certify` porque así lo nombra M2-D5;
// lo que hace es cerrar el stage y anclar la prueba.

const router = Router();

router.use(authenticate);

/** Fila 56v — la vista de certificación: el stage con su evidencia. */
router.get(
  "/certifier/stages/:id",
  requireRole("admin", "verifier"),
  requireProjectAccess({ via: "Stage", param: "id" }, ["verifier"]),
  async (req: Request<{ id: string }>, res) => {
    const stage = await db
      .selectFrom("Stage")
      .innerJoin("Project", "Project.id", "Stage.projectId")
      .select([
        "Stage.id as id",
        "Stage.name as name",
        "Stage.sequenceOrder as sequenceOrder",
        "Stage.state as state",
        "Stage.validationCritical as validationCritical",
        "Project.id as projectId",
        "Project.name as projectName"
      ])
      .where("Stage.id", "=", req.params.id)
      .executeTakeFirst();

    if (!stage) return res.status(404).json({ message: "Stage not found" });

    const evidencia = await db
      .selectFrom("Evidence")
      .select(["id", "originalFilename", "category", "authoritative", "sha256Hash", "uploadedAt"])
      .where("stageId", "=", stage.id)
      .orderBy("uploadedAt", "desc")
      .execute();

    // El empty-state de la fila 56v es parte del diseño, no un caso de error:
    // un stage sin evidencia se ve, y por eso la lista viaja vacía en vez de
    // 404.
    return res.json({ ...stage, evidence: evidencia });
  }
);

/** Fila 56c — certificar: cierra el stage y ancla su bundle. */
router.post(
  "/certifier/stages/:id/certify",
  requireRole("admin", "verifier"),
  requireProjectAccess({ via: "Stage", param: "id" }, ["verifier"]),
  async (req: Request<{ id: string }>, res) => {
    const resultado = await transitionStage({
      stageId: req.params.id,
      to: "Completed",
      actorUserId: req.user!.id,
      auditAction: "CERTIFY_STAGE"
    });

    if (!resultado.ok) {
      if (resultado.status === 404) return res.status(404).json({ message: "Stage not found" });
      return res.status(409).json(resultado);
    }

    return res.status(201).json({ ...resultado.stage, anchor: resultado.anchor });
  }
);

/** Fila 57 — observar: devuelve el stage al developer con una nota. */
router.post(
  "/certifier/stages/:id/observe",
  requireRole("admin", "verifier"),
  requireProjectAccess({ via: "Stage", param: "id" }, ["verifier"]),
  async (req: Request<{ id: string }>, res) => {
    const schema = z.strictObject({ note: z.string().min(1).max(2000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    // **La observación va al `AuditLog`, no al datum.** On-chain solo van
    // commitments y refs opacas (regla 2): el texto de una observación es
    // contenido, y además puede nombrar personas.
    const resultado = await transitionStage({
      stageId: req.params.id,
      to: "Observed",
      actorUserId: req.user!.id,
      note: parsed.data.note,
      auditAction: "OBSERVE_STAGE"
    });

    if (!resultado.ok) {
      if (resultado.status === 404) return res.status(404).json({ message: "Stage not found" });
      return res.status(409).json(resultado);
    }

    return res.status(201).json({ ...resultado.stage, anchor: resultado.anchor });
  }
);

/** Fila 58 — historial de lo emitido, con su hash y su TXID. */
router.get("/certifier/certificates", requireRole("admin", "verifier"), async (req, res) => {
  const schema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  let query = db
    .selectFrom("Stage")
    .innerJoin("Project", "Project.id", "Stage.projectId")
    .leftJoin("EvidenceBundle", "EvidenceBundle.stageId", "Stage.id")
    .leftJoin("OnChainEvent", (join) =>
      join
        .onRef("OnChainEvent.stageId", "=", "Stage.id")
        .on("OnChainEvent.eventType", "=", "STAGE_TRANSITION")
        .on("OnChainEvent.toState", "=", "Completed")
    )
    .select([
      "Stage.id as stageId",
      "Stage.name as stageName",
      "Stage.certifiedAt as certifiedAt",
      "Project.name as projectName",
      "EvidenceBundle.commitmentHash as commitmentHash",
      "OnChainEvent.txid as txid",
      "OnChainEvent.status as anchorStatus"
    ])
    .where("Stage.state", "=", "Completed")
    .where("Stage.certifiedById", "=", req.user!.id)
    .orderBy("Stage.certifiedAt", "desc")
    .limit(parsed.data.limit);

  // Paginación por cursor (M2-D5 pide `?cursor=` en las tres superficies de
  // historial): el cursor es el `certifiedAt` de la última fila devuelta.
  if (parsed.data.cursor) {
    query = query.where("Stage.certifiedAt", "<", new Date(parsed.data.cursor));
  }

  const filas = await query.execute();
  const ultima = filas.at(-1);

  return res.json({
    items: filas,
    nextCursor: ultima?.certifiedAt ? new Date(ultima.certifiedAt).toISOString() : null
  });
});

/**
 * Fila 25m — el camino de Merkle de un archivo dentro de su bundle.
 *
 * Es lo que vuelve real la promesa de M2-D4 P5: el revisor rehashea **su**
 * archivo, camina el árbol con estos hermanos y compara con la raíz anclada.
 * Sin esto, tendría que bajarse todos los archivos del bundle.
 */
router.get("/evidence/:bundleId/proof/:fileHash", async (req, res) => {
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
router.get("/evidence/:bundleId/files", async (req, res) => {
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
