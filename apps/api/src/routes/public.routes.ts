import { Readable } from "node:stream";
import { cuidParamSchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { db } from "../lib/db.js";
import { delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc.js";
import { storage } from "../lib/storage.js";
import { paramValidator } from "../middlewares/validate-params.js";

const PREFIJO_ABSOLUTO = "/api/v1/public";

const router = Router();

router.param("id", paramValidator(cuidParamSchema));

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
  projectCoverProcedure
};

export default router;
