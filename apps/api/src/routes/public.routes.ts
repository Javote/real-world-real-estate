import { type Request, Router } from "express";
import { compileDossier } from "../domain/dossier";
import { db } from "../lib/db";

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

const router = Router();

/**
 * Fila 28s — la vista pública. **Sin sesión**, por diseño (M2-D5 §2.2).
 *
 * Lo que sale de acá lo puede leer cualquiera que tenga el link, así que va
 * recortado: hashes, TXID y etiquetas de artefacto, y NADA de la unidad ni del
 * investor más allá de su referencia. Un token que no existe es 404 sin más
 * detalle: no hay por qué distinguir "revocado" de "nunca existió".
 */
router.get("/dossier/:shareToken", async (req: Request<{ shareToken: string }>, res) => {
  const fila = await db
    .selectFrom("Dossier")
    .select(["unitId"])
    .where("shareToken", "=", req.params.shareToken)
    .executeTakeFirst();

  if (!fila) return res.status(404).json({ message: "Dossier not found" });

  const dossier = await compileDossier(fila.unitId);
  if (!dossier) return res.status(404).json({ message: "Dossier not found" });

  return res.json({
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

export default router;
