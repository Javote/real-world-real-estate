import { Readable } from "node:stream";
import { cuidParamSchema, hex64ParamSchema, publicDossierSchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { compileDossier } from "../domain/dossier.js";
import { db } from "../lib/db.js";
import { delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc.js";
import { storage } from "../lib/storage.js";
import { dossierRateLimiter } from "../middlewares/rateLimit.js";
import { paramValidator } from "../middlewares/validate-params.js";

const PREFIJO_ABSOLUTO = "/api/v1/public";

const router = Router();

router.param("shareToken", paramValidator(hex64ParamSchema));
router.param("id", paramValidator(cuidParamSchema));

const publicDossierProcedure = os
  .route({ method: "GET", path: "/dossier/{shareToken}" })
  .input(z.strictObject({ shareToken: hex64ParamSchema }))
  .output(publicDossierSchema)
  .handler(async ({ input }) => {
    const fila = await db
      .selectFrom("Dossier")
      .select(["unitId"])
      .where("shareToken", "=", input.shareToken)
      .executeTakeFirst();

    if (!fila) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    const dossier = await compileDossier(fila.unitId);
    /* v8 ignore if -- @preserve: FK Dossier.unitId → Unit.id es ON DELETE CASCADE */
    if (!dossier) throw new ORPCError("NOT_FOUND", { message: "Dossier not found" });

    return publicDossierSchema.parse({
      unitReference: dossier.unitReference,
      projectName: dossier.projectName,
      masterHash: dossier.masterHash,
      compiledAt: dossier.compiledAt,
      status: dossier.status,
      completeness: dossier.completeness,
      signatureTxid: dossier.signatureTxid,
      signedAt: dossier.signedAt,
      artifacts: dossier.artifacts
    });
  });
const publicDossierHandler = new OpenAPIHandler({ publicDossierProcedure });

router.get(
  "/dossier/:shareToken",
  dossierRateLimiter(),
  delegarAOrpc(publicDossierHandler, PREFIJO_ABSOLUTO)
);

const projectCoverProcedure = os
  .route({ method: "GET", path: "/projects/{id}/cover", outputStructure: "detailed" })
  .input(z.strictObject({ id: cuidParamSchema, v: z.string().max(64).optional() }))
  .output(
    z.object({
      headers: z.record(z.string(), z.string()).optional(),
      body: z.instanceof(ReadableStream)
    })
  )
  .handler(async ({ input }) => {
    const portada = await db
      .selectFrom("ProjectCover")
      .select(["storageRef", "mimeType"])
      .where("projectId", "=", input.id)
      .executeTakeFirst();

    if (!portada || !(await storage.exists(portada.storageRef))) {
      throw new ORPCError("NOT_FOUND", { message: "Cover not found" });
    }

    const contenido = await storage.read(portada.storageRef);
    return {
      headers: {
        "content-type": portada.mimeType,
        "cache-control": "public, max-age=31536000, immutable",
        "cross-origin-resource-policy": "cross-origin"
      },
      body: Readable.toWeb(contenido) as ReadableStream
    };
  });
const projectCoverHandler = new OpenAPIHandler({ projectCoverProcedure });

router.get("/projects/:id/cover", delegarAOrpc(projectCoverHandler, PREFIJO_ABSOLUTO));

export const publicOrpcRouter = {
  publicDossierProcedure,
  projectCoverProcedure
};

export default router;
