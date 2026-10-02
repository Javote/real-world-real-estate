import fs from "node:fs";
import path from "node:path";
import {
  cuidParamSchema,
  detectarTipoDePortada,
  EVIDENCE_SIGNATURE_BYTES,
  projectCoverResultSchema
} from "@plataforma/shared";
import { type Request, Router } from "express";
import { db } from "../lib/db.js";
import { leerCabecera, storage } from "../lib/storage.js";
import { uploadProjectCoverFile } from "../lib/upload.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { paramValidator } from "../middlewares/validate-params.js";
import { writeAuditLog } from "../utils/audit.js";

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

router.use(authenticate);

router.put(
  "/projects/:id/cover",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  (req, res, next) => {
    uploadProjectCoverFile(req, res, (err) => (err ? next(err) : next()));
  },
  async (req: Request<{ id: string }>, res, next) => {
    const projectId = req.params.id;
    const file = req.file;

    let confirmado = false;
    let subido: string | null = null;

    try {
      if (!file) return res.status(400).json({ message: "File is required" });

      const real = detectarTipoDePortada(await leerCabecera(file.path, EVIDENCE_SIGNATURE_BYTES));
      if (real === null || real !== file.mimetype) {
        return res.status(400).json({
          message: "The cover must be a JPEG or PNG image",
          code: "UNSUPPORTED_FILE_TYPE"
        });
      }

      const anterior = await db
        .selectFrom("ProjectCover")
        .select("storageRef")
        .where("projectId", "=", projectId)
        .executeTakeFirst();

      const { storageRef } = await storage.put({
        localPath: path.resolve(file.path),
        key: `project-cover/${projectId}/${file.filename}`,
        contentType: real
      });
      subido = storageRef;

      const ahora = new Date();
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto("ProjectCover")
          .values({
            projectId,
            storageRef,
            mimeType: real,
            sizeBytes: file.size,
            uploadedById: req.user!.id,
            updatedAt: ahora
          })
          .onConflict((oc) =>
            oc.column("projectId").doUpdateSet({
              storageRef,
              mimeType: real,
              sizeBytes: file.size,
              uploadedById: req.user!.id,
              updatedAt: ahora
            })
          )
          .execute();
        await trx
          .updateTable("Project")
          .set({ coverUpdatedAt: ahora, updatedAt: ahora })
          .where("id", "=", projectId)
          .execute();
      });
      confirmado = true;

      if (anterior) {
        await storage
          .remove(anterior.storageRef)
          .catch((e) => console.error("[portada] no se pudo borrar la anterior", e));
      }

      await writeAuditLog({
        actorUserId: req.user!.id,
        action: "UPDATE_PROJECT_COVER",
        entityType: "Project",
        entityId: projectId
      });

      return res.status(200).json(projectCoverResultSchema.parse({ coverUpdatedAt: ahora }));
    } catch (err) {
      return next(err);
    } finally {
      if (file && (!confirmado || storage.driver === "s3") && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      if (!confirmado && subido) {
        await storage.remove(subido).catch((e) => console.error("[portada] no se pudo limpiar", e));
      }
    }
  }
);

export default router;
