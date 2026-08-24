import type { CertifierAssignment, CertifierKpis } from "@plataforma/shared";
import { type Request, Router } from "express";
import { z } from "zod";
import { transitionStage } from "../domain/stage-transition";
import { db } from "../lib/db";
import { authenticate, requireProjectAccess, requireRole } from "../middlewares/auth";
import { proyectosVisibles } from "./_shared";

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

router.get("/kpis", requireRole("admin", "verifier"), async (req, res) => {
  const ids = (await proyectosVisibles(req.user!.id, req.user!.role).execute()).map((p) => p.id);

  const stages = ids.length
    ? await db.selectFrom("Stage").select(["state"]).where("projectId", "in", ids).execute()
    : [];

  const kpis: CertifierKpis = {
    // "Asignado" es, por ahora, un stage en curso dentro de un proyecto donde
    // este usuario es miembro con rol verifier. El modelo de asignación
    // explícita todavía no existe.
    assigned: stages.filter((s) => s.state === "InProgress").length,
    certified: stages.filter((s) => s.state === "Completed").length,
    observed: stages.filter((s) => s.state === "Observed").length,
    totalStages: stages.length
  };

  return res.json(kpis);
});

router.get("/assignments", requireRole("admin", "verifier"), async (req, res) => {
  const ids = (await proyectosVisibles(req.user!.id, req.user!.role).execute()).map((p) => p.id);

  if (ids.length === 0) return res.json([] satisfies CertifierAssignment[]);

  const filas = await db
    .selectFrom("Stage")
    .innerJoin("Project", "Project.id", "Stage.projectId")
    .select([
      "Stage.id as stageId",
      "Stage.name as stageName",
      "Stage.sequenceOrder as sequenceOrder",
      "Project.name as projectName"
    ])
    .where("Stage.projectId", "in", ids)
    .where("Stage.state", "in", ["InProgress", "Observed"])
    .orderBy("Stage.sequenceOrder", "asc")
    .execute();

  return res.json(filas satisfies CertifierAssignment[]);
});

/** Fila 56v — la vista de certificación: el stage con su evidencia. */
router.get(
  "/stages/:id",
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
  "/stages/:id/certify",
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
  "/stages/:id/observe",
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
router.get("/certificates", requireRole("admin", "verifier"), async (req, res) => {
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

export default router;
