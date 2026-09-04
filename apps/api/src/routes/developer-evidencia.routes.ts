import fs from "node:fs";
import path from "node:path";
import { type Request, Router } from "express";
import { z } from "zod";
import { createId } from "../db/id";
import { anchorCommitmentEvent } from "../domain/anchoring";
import { notifyUnitInvestor } from "../domain/notify";
import { crearBundle } from "../domain/stage-transition";
import { db } from "../lib/db";
import { storage } from "../lib/storage";
import { uploadSingleEvidence } from "../lib/upload";
import { authenticate, authorize } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared";

// **La subida anclada de evidencia por stage** (M2-D5 filas 38 y 44c) —
// M3-BE-13 y M3-SC-02, patrones P4 y P5.
//
// Un solo endpoint, y en archivo propio porque no se parece a nada más del
// prefijo: es el único que combina multipart, storage, hashing, armado de
// bundle y anclaje en la misma request. M2-D5 §2.2 lo obliga —*"client awaits
// success with TXID/Merkle root in the same response"*— porque es lo que
// alimenta el `AnchoringSuccessModal`, la única superficie de prueba que se
// abre sola (M2-D4 §6.3).

const router = Router();

router.use(authenticate);

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
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
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
        .transform((v) => v === "true"),
      // Declaración de origen (D-028 (a)). Va vacía salvo que se declare
      // autoritativa, y se guarda `null` en vez de "" para que el guard de la
      // transición tenga un solo estado de "falta".
      issuingAuthority: z
        .string()
        .max(200)
        .optional()
        .transform((v) => v?.trim() || null)
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
        issuingAuthority: parsed.data.issuingAuthority,
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
