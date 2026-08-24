import { randomBytes } from "node:crypto";
import type { DossierShare } from "@plataforma/shared";
import { type Request, Router } from "express";
import { compileDossier } from "../domain/dossier";
import { db } from "../lib/db";
import { authenticate, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../utils/audit";
import { renderTextPdf } from "../utils/pdf";

// El dossier del investor (M2-D5 filas 26-29 y 28s) — **M3-BE-12**, patrón P8.
//
// **`authenticate` NO va a nivel de router acá.** `GET /public/dossier/:token`
// es, junto con `POST /auth/login`, uno de los dos endpoints sin sesión de todo
// el backlog (M2-D5 §2.2) — es el link de solo lectura que un investor le pasa
// a un notario que no tiene cuenta. Un `router.use(authenticate)` lo rompería,
// así que el middleware va ruta por ruta y esta ruta declara su excepción a la
// vista.

const router = Router();

const soloInvestor = [authenticate, requireRole("admin", "buyer")] as const;

/** El investor ve SU dossier y ninguno más (M2-D1 §Cross-role data isolation). */
async function dossierDeLaUnidad(unitId: string, user: { id: string; role: string }) {
  const dossier = await compileDossier(unitId);
  if (!dossier) return { error: 404 as const };
  if (user.role !== "admin" && dossier.investorId !== user.id) return { error: 403 as const };
  return { dossier };
}

/** Fila 26-29 — el dossier compilado, con su hash maestro. */
router.get(
  "/investor/units/:id/dossier",
  ...soloInvestor,
  async (req: Request<{ id: string }>, res) => {
    const resultado = await dossierDeLaUnidad(req.params.id, req.user!);
    if (resultado.error === 404) return res.status(404).json({ message: "Unit not found" });
    if (resultado.error === 403) return res.status(403).json({ message: "Forbidden" });

    const { investorId: _investorId, ...dossier } = resultado.dossier;
    return res.json(dossier);
  }
);

/**
 * Fila 26-29 — el export. El PDF es una TRANSCRIPCIÓN del dossier, no una
 * prueba nueva: lleva los mismos hashes y los mismos TXID, completos (regla
 * 16), para que quien lo reciba pueda verificarlos contra el explorer por su
 * cuenta. Un artefacto que dijera "verificado" sin traer con qué comprobarlo
 * sería exactamente lo que D-026 prohíbe.
 */
router.get(
  "/investor/units/:id/dossier/export.pdf",
  ...soloInvestor,
  async (req: Request<{ id: string }>, res) => {
    const resultado = await dossierDeLaUnidad(req.params.id, req.user!);
    if (resultado.error === 404) return res.status(404).json({ message: "Unit not found" });
    if (resultado.error === 403) return res.status(403).json({ message: "Forbidden" });

    const d = resultado.dossier;
    const pdf = renderTextPdf([
      "PropNexus - Proof dossier",
      "",
      `Project:      ${d.projectName}`,
      `Unit:         ${d.unitReference}`,
      `Compiled at:  ${d.compiledAt.toISOString()}`,
      `Status:       ${d.status}`,
      `Master hash:  ${d.masterHash}`,
      `Notary TXID:  ${d.signatureTxid ?? "(pending)"}`,
      `Completeness: ${d.completeness}% of artifacts have an on-chain reference`,
      "",
      "This document asserts only that these hashes were registered at these times,",
      "and, where a signature TXID is present, that a notary attested to reviewing them.",
      "It certifies nothing about the construction itself.",
      "",
      "Artifacts",
      "---------",
      ...d.artifacts.flatMap((a) => [
        `[${a.kind}] ${a.label}`,
        `  sha256: ${a.sha256 ?? "(none)"}`,
        `  txid:   ${a.txid ?? "(pending)"}`
      ])
    ]);

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: "EXPORT_DOSSIER",
      entityType: "Dossier",
      entityId: d.id,
      metadata: { masterHash: d.masterHash }
    });

    res.setHeader("Content-Type", "application/pdf");
    // El nombre lleva la ref de la unidad, que no es PII. Nunca el nombre del
    // investor.
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="dossier-${d.unitReference.replace(/[^\w.-]/g, "_")}.pdf"`
    );
    return res.send(pdf);
  }
);

/**
 * Fila 28s — compartir. El token es opaco y de 256 bits: es la única
 * credencial del link público, así que no puede derivarse del id de la unidad
 * ni de nada adivinable.
 *
 * **Idempotente** (regla 8): volver a compartir devuelve el MISMO token en vez
 * de invalidar el link que ya se mandó por mail.
 */
router.post(
  "/investor/units/:id/dossier/share",
  ...soloInvestor,
  async (req: Request<{ id: string }>, res) => {
    const resultado = await dossierDeLaUnidad(req.params.id, req.user!);
    if (resultado.error === 404) return res.status(404).json({ message: "Unit not found" });
    if (resultado.error === 403) return res.status(403).json({ message: "Forbidden" });

    const d = resultado.dossier;

    const fila = await db
      .selectFrom("Dossier")
      .select("shareToken")
      .where("id", "=", d.id)
      .executeTakeFirstOrThrow();

    let token = fila.shareToken;
    if (!token) {
      token = randomBytes(32).toString("hex");
      await db.updateTable("Dossier").set({ shareToken: token }).where("id", "=", d.id).execute();

      await writeAuditLog({
        actorUserId: req.user!.id,
        action: "SHARE_DOSSIER",
        entityType: "Dossier",
        entityId: d.id
      });
    }

    // Path sin host: el cliente lo compone con su propio origen. La API no
    // sabe —ni debe saber— bajo qué dominio se sirve el front.
    return res.status(201).json({
      shareToken: token,
      path: `/api/v1/public/dossier/${token}`,
      masterHash: d.masterHash
    } satisfies DossierShare);
  }
);

/**
 * Fila 28s — la vista pública. **Sin sesión**, por diseño (M2-D5 §2.2).
 *
 * Lo que sale de acá lo puede leer cualquiera que tenga el link, así que va
 * recortado: hashes, TXID y etiquetas de artefacto, y NADA de la unidad ni del
 * investor más allá de su referencia. Un token que no existe es 404 sin más
 * detalle: no hay por qué distinguir "revocado" de "nunca existió".
 */
router.get("/public/dossier/:shareToken", async (req: Request<{ shareToken: string }>, res) => {
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
