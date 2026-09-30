import { Readable } from "node:stream";
import { cuidParamSchema, hex64ParamSchema, publicDossierSchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { compileDossier } from "../domain/dossier";
import { db } from "../lib/db";
import { delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
import { storage } from "../lib/storage";
import { dossierRateLimiter } from "../middlewares/rateLimit";
import { paramValidator } from "../middlewares/validate-params";

// **Lo único sin sesión de todo el backlog, junto con `POST /auth/login`**
// (M2-D5 §2.2): el link de solo lectura que un investor le pasa a un notario
// que no tiene cuenta.
//
// Vive en su propio router y bajo su propio prefijo justamente por eso. Antes
// estaba mezclado con la superficie del investor sobre `/api/v1` pelado, y
// cualquier router con `router.use(authenticate)` montado antes lo mataba con
// un 401 — que es exactamente lo que pasó (SPEC-015 §4). Acá esa clase de bug
// no puede volver: este router **no tiene** middleware de sesión, y ningún otro
// puede ver una request que empiece con `/public`.
//
// Lo que sale de acá lo lee cualquiera que tenga el link, así que va recortado.
//
// **SPEC-216 §E2 — migrado a oRPC (D-066), junto con `auth.routes.ts`.** Sin
// contexto: ningún procedimiento acá necesita `req.user`, así que no hace
// falta `$context` — plain `os`, como `pendingDossiersProcedure` en
// `notary.routes.ts`.

const PREFIJO_ABSOLUTO = "/api/v1/public";

const router = Router();

router.param("shareToken", paramValidator(hex64ParamSchema));
router.param("id", paramValidator(cuidParamSchema));

/**
 * Fila 28s — la vista pública. **Sin sesión**, por diseño (M2-D5 §2.2).
 *
 * Lo que sale de acá lo puede leer cualquiera que tenga el link, así que va
 * recortado: hashes, TXID y etiquetas de artefacto, y NADA de la unidad ni del
 * investor más allá de su referencia. Un token que no existe es 404 sin más
 * detalle: no hay por qué distinguir "revocado" de "nunca existió".
 */
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
    /* v8 ignore if -- @preserve: FK Dossier.unitId → Unit.id es ON DELETE CASCADE (SPEC-018) */
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

/**
 * D-099 — la portada del proyecto, **sin sesión**. Es material comercial (un
 * render, una foto de fachada), no evidencia ni PII, y el id del proyecto es
 * opaco: servirla pública deja que la card la dibuje con un `<img>` común, que
 * el navegador cachea, en vez de bajarla como blob autenticado una por una.
 *
 * **`v` es la versión, no un filtro:** el front la arma con `coverUpdatedAt`.
 * Una portada nueva es una URL nueva, así que la respuesta puede cachearse
 * como inmutable sin que un cambio quede tapado.
 *
 * **`Cross-Origin-Resource-Policy: cross-origin` no es opcional.** helmet pone
 * `same-origin` en toda respuesta, y el web vive en otro origen (D-065): sin
 * pisarlo acá, el navegador descarta la imagen aunque la respuesta sea 200.
 *
 * Streaming igual que `GET /evidence/:id/download` (SPEC-217): el objeto no
 * pasa entero por memoria.
 */
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

    // "Sin portada" y "proyecto inexistente" responden igual: no hay por qué
    // confirmarle a quien no tiene sesión qué ids existen.
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

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de la
 * única ruta migrada. */
export const publicOrpcRouter = {
  publicDossierProcedure,
  projectCoverProcedure
};

export default router;
