import { hex64ParamSchema, publicDossierSchema } from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import { compileDossier } from "../domain/dossier";
import { db } from "../lib/db";
import { delegarAOrpc, OpenAPIHandler, ORPCError, os } from "../lib/orpc";
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

/** El router oRPC combinado de esta vertical — lo consume
 * `scripts/generate-openapi.ts` para generar el fragmento de OpenAPI de la
 * única ruta migrada. */
export const publicOrpcRouter = {
  publicDossierProcedure
};

export default router;
