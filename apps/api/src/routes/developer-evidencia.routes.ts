import fs from "node:fs";
import path from "node:path";
import {
  cuidParamSchema,
  detectarTipoDeEvidencia,
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_SIGNATURE_BYTES,
  EVIDENCE_UNATTRIBUTED,
  type EvidenceMime,
  type EvidenceRejection,
  evidenciaSinAtribuir,
  stageEvidenceUploadResultSchema,
  stageEvidenceUploadSchema
} from "@plataforma/shared";
import { type Request, type RequestHandler, Router } from "express";
import type { z } from "zod";
import { createId } from "../db/id.js";
import { anchorCommitmentEvent } from "../domain/anchoring.js";
import { notifyUnitInvestors } from "../domain/notify.js";
import { crearBundle, transitionStage } from "../domain/stage-transition.js";
import { db } from "../lib/db.js";
import { call, ORPCError, os } from "../lib/orpc.js";
import { leerCabecera, sha256DeArchivo, storage } from "../lib/storage.js";
import { uploadEvidenceFiles } from "../lib/upload.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { codigoDeRestriccion } from "../middlewares/errorHandler.js";
import { paramValidator } from "../middlewares/validate-params.js";
import { writeAuditLog } from "../utils/audit.js";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared.js";

const validarCamposDeTexto = os
  .route({ method: "POST", path: "/projects/{id}/stages/{stageId}/evidence" })
  .input(stageEvidenceUploadSchema)
  .handler(({ input }) => input);

const router = Router();

router.param("id", paramValidator(cuidParamSchema));
router.param("stageId", paramValidator(cuidParamSchema));

router.use(authenticate);

async function stageQueAceptaSubida(projectId: string, stageId: string) {
  const stage = await db
    .selectFrom("Stage")
    .selectAll()
    .where("id", "=", stageId)
    .where("projectId", "=", projectId)
    .executeTakeFirst();

  if (!stage) {
    return { rechazo: { status: 404, body: { message: "Stage does not belong to project" } } };
  }
  if (stage.state === "Completed") {
    return {
      rechazo: {
        status: 409,
        body: {
          message: "A completed stage does not accept more evidence",
          code: "STAGE_ALREADY_COMPLETED"
        }
      }
    };
  }
  return { stage };
}

const TOPE_DE_DRENAJE = EVIDENCE_MAX_FILES * EVIDENCE_MAX_FILE_BYTES + 1024 * 1024;

const rechazarStageAntesDeRecibir: RequestHandler<{ id: string; stageId: string }> = async (
  req,
  res,
  next
) => {
  try {
    const { rechazo } = await stageQueAceptaSubida(req.params.id, req.params.stageId);
    if (!rechazo) return next();

    const responder = () => void res.status(rechazo.status).json(rechazo.body);
    if (req.readableEnded) return responder();

    let leidos = 0;
    req.on("data", (chunk: Buffer) => {
      leidos += chunk.length;
      if (leidos > TOPE_DE_DRENAJE) req.destroy();
    });
    req.once("end", responder);
    req.resume();
  } catch (err) {
    next(err);
  }
};

router.post(
  "/projects/:id/stages/:stageId/evidence",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  rechazarStageAntesDeRecibir,
  (req, res, next) => {
    uploadEvidenceFiles(req, res, (err) => (err ? next(err) : next()));
  },
  async (req: Request<{ id: string; stageId: string }>, res, next) => {
    const { id: projectId, stageId } = req.params;
    const archivos = (req.files ?? []) as Express.Multer.File[];

    let confirmado = false;
    const subidos: string[] = [];

    try {
      if (archivos.length === 0) return res.status(400).json({ message: "File is required" });

      let parsed: z.infer<typeof stageEvidenceUploadSchema>;
      try {
        parsed = await call(validarCamposDeTexto, req.body);
      } catch (err) {
        /* v8 ignore if -- @preserve: el procedure solo tiene .input(); su handler devuelve el input y no tira, así que call() solo rechaza con el ORPCError BAD_REQUEST de la validación */
        if (err instanceof ORPCError) return res.status(err.status).json(err.toJSON());
        /* v8 ignore next -- @preserve: inalcanzable por lo mismo que el if de arriba, call() solo rechaza con ORPCError */
        throw err;
      }

      if (evidenciaSinAtribuir(parsed)) {
        return res.status(400).json({
          message: "Authoritative evidence must name its issuing authority",
          code: EVIDENCE_UNATTRIBUTED
        });
      }

      const { stage, rechazo } = await stageQueAceptaSubida(projectId, stageId);
      if (rechazo) return res.status(rechazo.status).json(rechazo.body);

      const rechazados: EvidenceRejection[] = [];
      const candidatos: {
        indice: number;
        file: Express.Multer.File;
        mime: EvidenceMime;
        sha256: string;
      }[] = [];

      for (const [indice, file] of archivos.entries()) {
        const cabecera = await leerCabecera(file.path, EVIDENCE_SIGNATURE_BYTES);
        const real = detectarTipoDeEvidencia(cabecera);
        if (real === null || real !== file.mimetype) {
          rechazados.push({ index: indice, code: "UNSUPPORTED_FILE_TYPE" });
          continue;
        }
        candidatos.push({ indice, file, mime: real, sha256: await sha256DeArchivo(file.path) });
      }

      const existentes = new Set(
        candidatos.length === 0
          ? []
          : (
              await db
                .selectFrom("Evidence")
                .select("sha256Hash")
                .where("stageId", "=", stage.id)
                .where(
                  "sha256Hash",
                  "in",
                  candidatos.map((c) => c.sha256)
                )
                .execute()
            ).map((f) => f.sha256Hash)
      );

      const vistos = new Set<string>();
      const aceptados: typeof candidatos = [];
      for (const c of candidatos) {
        if (existentes.has(c.sha256)) {
          rechazados.push({ index: c.indice, code: "EVIDENCE_ALREADY_IN_STAGE" });
        } else if (vistos.has(c.sha256)) {
          rechazados.push({ index: c.indice, code: "DUPLICATE_FILE_IN_BATCH" });
        } else {
          vistos.add(c.sha256);
          aceptados.push(c);
        }
      }
      rechazados.sort((a, b) => a.index - b.index);

      const aceptadosIdx = new Set(aceptados.map((a) => a.indice));
      for (const [indice, file] of archivos.entries()) {
        if (!aceptadosIdx.has(indice) && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }

      if (aceptados.length === 0) {
        return res.status(400).json({
          message: "No file was accepted",
          code: "NO_FILES_ACCEPTED",
          rejected: rechazados
        });
      }

      const guardados: {
        id: string;
        c: (typeof aceptados)[number];
        storageRef: string;
        sha256: string;
      }[] = [];
      for (const c of aceptados) {
        const g = await storage.put({
          localPath: path.resolve(c.file.path),
          key: `evidence/${projectId}/${c.file.filename}`,
          contentType: c.mime
        });
        subidos.push(g.storageRef);
        if (g.sha256 !== c.sha256) {
          throw new Error("El hash del archivo guardado no coincide con el del temporal");
        }
        guardados.push({ id: createId(), c, storageRef: g.storageRef, sha256: g.sha256 });
      }

      const now = new Date();
      try {
        // Un solo INSERT: entran todos los archivos del lote o ninguno.
        await db
          .insertInto("Evidence")
          .values(
            guardados.map((g) => ({
              id: g.id,
              projectId,
              stageId,
              uploadedById: req.user!.id,
              evidenceType: parsed.evidenceType,
              category: parsed.category,
              /* v8 ignore start -- @preserve: multipartBooleanSchema ya transforma undefined a false; el output es boolean, nunca nullish */
              authoritative: parsed.authoritative ?? false,
              /* v8 ignore stop -- @preserve */
              issuingAuthority: parsed.issuingAuthority,
              originalFilename: g.c.file.originalname,
              storedFilename: g.c.file.filename,
              mimeType: g.c.mime,
              sizeBytes: g.c.file.size,
              storagePath: g.storageRef,
              sha256Hash: g.sha256,
              uploadedAt: now,
              createdAt: now,
              updatedAt: now
            }))
          )
          .execute();
      } catch (err) {
        if (
          codigoDeRestriccion(err) === "SQLITE_CONSTRAINT_UNIQUE" &&
          err instanceof Error &&
          err.message.includes("Evidence.stageId, Evidence.sha256Hash")
        ) {
          return res.status(409).json({
            message: "One of the files in this batch was already uploaded to this stage",
            code: "EVIDENCE_ALREADY_IN_STAGE"
          });
        }
        throw err;
      }
      confirmado = true;

      const merkleRoot = await crearBundle(stage, req.user!.id);

      const bundle = await db
        .selectFrom("EvidenceBundle")
        .select(["id", "commitmentHash"])
        .where("stageId", "=", stage.id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirstOrThrow();

      const anchor = await anchorCommitmentEvent({
        projectId,
        stageId: stage.id,
        evidenceId: guardados[0]!.id,
        eventType: "EVIDENCE_ANCHOR",
        commitment: bundle.commitmentHash,
        reference: bundle.id
      });

      const ids = guardados.map((g) => g.id);
      const filas = await db
        .selectFrom("Evidence")
        .select(EVIDENCE_SAFE_COLUMNS)
        .where("id", "in", ids)
        .execute();
      const evidences = ids.map((id) => filas.find((f) => f.id === id)!);

      const unidades = await db
        .selectFrom("Unit")
        .select(["id", "investorId"])
        .where("projectId", "=", projectId)
        .where("investorId", "is not", null)
        .execute();

      await notifyUnitInvestors(
        unidades
          .filter((u): u is { id: string; investorId: string } => u.investorId !== null)
          .map((u) => ({ unitId: u.id, investorId: u.investorId })),
        {
          category: "document",
          titleKey: "notifications.evidence.uploaded",
          params: { stageName: stage.name }
        }
      );

      for (const g of guardados) {
        await writeAuditLog({
          actorUserId: req.user!.id,
          action: "UPLOAD_STAGE_EVIDENCE",
          entityType: "Evidence",
          entityId: g.id,
          metadata: { bundleId: bundle.id, merkleRoot, txid: anchor.txid }
        });
      }

      if (stage.state === "Pending") {
        await transitionStage({
          stageId: stage.id,
          to: "InProgress",
          actorUserId: req.user!.id,
          auditAction: "STAGE_WORK_INITIATED"
        });
      }

      return res.status(201).json(
        stageEvidenceUploadResultSchema.parse({
          evidences,
          rejected: rechazados,
          bundleId: bundle.id,
          merkleRoot: bundle.commitmentHash,
          anchor
        })
      );
    } catch (err) {
      return next(err);
    } finally {
      for (const f of archivos) {
        if ((!confirmado || storage.driver === "s3") && fs.existsSync(f.path))
          fs.unlinkSync(f.path);
      }
      if (!confirmado) {
        for (const ref of subidos) {
          await storage.remove(ref).catch((e) => console.error("[upload] no se pudo limpiar", e));
        }
      }
    }
  }
);

export default router;
