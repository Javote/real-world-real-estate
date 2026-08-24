import type {
  CertifierAssignment,
  CertifierKpis,
  DeveloperKpis,
  NotaryKpis,
  PendingDossier
} from "@plataforma/shared";
import { Router } from "express";
import type { UserRole } from "../db/types";
import { compileDossier } from "../domain/dossier";
import { db } from "../lib/db";
import { authenticate, projectScope, requireRole } from "../middlewares/auth";

// Los paneles de rol (M2-D5 filas 33-34, 51, 55). **Paths scopeados por rol**,
// que es la forma que pide el backlog (D-066): `/developer/*`, `/notary/*`,
// `/certifier/*`.
//
// **Qué se puede calcular hoy, y qué no.** Las tres entidades que faltaban
// —`Unit`, `Contract`, `Dossier`— ya existen, así que los KPI que dependían de
// ellas se cuentan de verdad. Los schemas los siguen aceptando nullable a
// propósito: `null` es "no hay con qué contarlas" y cero es "no hay ninguna",
// y esa distinción tiene que sobrevivir a que hoy no haga falta usarla. Un
// proyecto sin unidades cargadas devuelve 0 unidades, que ES la verdad.
//
// Ningún endpoint de acá inventa un número.

const router = Router();

router.use(authenticate);

/** Los proyectos que este usuario ve, con la misma regla que el resto (D-043). */
function proyectosVisibles(userId: string, role: UserRole) {
  return db
    .selectFrom("Project")
    .select("Project.id")
    .where((eb) => projectScope(eb, role, userId, ["developer", "buyer", "verifier"]));
}

router.get("/developer/kpis", requireRole("admin", "developer"), async (req, res) => {
  const ids = (await proyectosVisibles(req.user!.id, req.user!.role).execute()).map((p) => p.id);

  if (ids.length === 0) {
    const vacio: DeveloperKpis = {
      activeProjects: 0,
      totalUnits: 0,
      capitalRaisedMinorUnits: 0,
      averageProgress: 0,
      verifiedDocuments: 0
    };
    return res.json(vacio);
  }

  const stages = await db
    .selectFrom("Stage")
    .select(["state"])
    .where("projectId", "in", ids)
    .execute();

  const anclados = await db
    .selectFrom("OnChainEvent")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("projectId", "in", ids)
    .where("eventType", "=", "EVIDENCE_ANCHOR")
    .where("status", "=", "Confirmed")
    .executeTakeFirst();

  const unidades = await db
    .selectFrom("Unit")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("projectId", "in", ids)
    .executeTakeFirst();

  // "Capital levantado" = suma de los contratos firmados. **No es plata que la
  // plataforma tenga** (D-021): es un monto declarado, en unidades mínimas
  // enteras (regla 1).
  const contratos = await db
    .selectFrom("Contract")
    .innerJoin("Unit", "Unit.id", "Contract.unitId")
    .select((eb) => eb.fn.sum<number>("Contract.totalMinorUnits").as("total"))
    .where("Unit.projectId", "in", ids)
    .executeTakeFirst();

  const completados = stages.filter((s) => s.state === "Completed").length;

  const kpis: DeveloperKpis = {
    activeProjects: ids.length,
    totalUnits: Number(unidades?.total ?? 0),
    capitalRaisedMinorUnits: Number(contratos?.total ?? 0),
    averageProgress: stages.length ? Math.round((completados / stages.length) * 100) : 0,
    verifiedDocuments: Number(anclados?.total ?? 0)
  };

  return res.json(kpis);
});

router.get("/certifier/kpis", requireRole("admin", "verifier"), async (req, res) => {
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

router.get("/certifier/assignments", requireRole("admin", "verifier"), async (req, res) => {
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

/**
 * Fila 51 — los KPI del notario. **Ya no son `null`.**
 *
 * Lo eran mientras el dossier no existía como entidad: `null` decía "no hay
 * modelo" y cero habría dicho "no tenés trabajo", que es una afirmación
 * distinta. Ahora `Dossier` existe y los cuatro se cuentan de verdad — el
 * schema los sigue aceptando nullable porque la distinción vale para los KPI
 * del developer que todavía no se pueden calcular.
 */
router.get("/notary/kpis", requireRole("admin", "notary"), async (req, res) => {
  const filas = await db
    .selectFrom("Dossier")
    .select(["id", "status", "signedById", "unitId"])
    .execute();

  // Un admin ve el total; un notario, lo que firmó él más la cola común.
  const firmados = filas.filter(
    (f) => f.status === "signed" && (req.user!.role === "admin" || f.signedById === req.user!.id)
  );
  const pendientes = filas.filter((f) => f.status === "compiled");

  const kpis: NotaryKpis = {
    pendingDossiers: pendientes.length,
    // "Verificado" acá es el dossier revisado y resuelto: firmado o rechazado.
    // No afirma nada sobre la obra (D-026).
    verified: filas.filter((f) => f.status !== "compiled").length,
    signed: firmados.length,
    unitsUnderReview: new Set(pendientes.map((f) => f.unitId)).size
  };
  return res.json(kpis);
});

/**
 * Fila 51 — la cola de revisión, con la barra de completitud.
 *
 * `completeness` es **qué fracción de la evidencia del dossier tiene su prueba
 * sustanciada**, no "cuán listo está": un dossier al 60% tiene el 40% de sus
 * artefactos todavía sin TXID (regla 17).
 */
router.get("/notary/dossiers/pending", requireRole("admin", "notary"), async (_req, res) => {
  const filas = await db
    .selectFrom("Dossier")
    .innerJoin("Unit", "Unit.id", "Dossier.unitId")
    .leftJoin("User", "User.id", "Unit.investorId")
    .select([
      "Dossier.id as dossierId",
      "Dossier.unitId as unitId",
      "Unit.unitReference as unitReference",
      "User.fullName as investorName"
    ])
    .where("Dossier.status", "=", "compiled")
    .orderBy("Dossier.compiledAt", "asc")
    .limit(50)
    .execute();

  const pendientes: PendingDossier[] = [];
  for (const fila of filas) {
    const dossier = await compileDossier(fila.unitId);
    pendientes.push({
      dossierId: fila.dossierId,
      unitLabel: fila.unitReference,
      // Sin investor asignado la unidad no se vendió todavía; el panel muestra
      // la referencia de la unidad y no un nombre inventado.
      investorName: fila.investorName ?? fila.unitReference,
      completeness: dossier?.completeness ?? 0
    });
  }

  return res.json(pendientes);
});

export default router;
