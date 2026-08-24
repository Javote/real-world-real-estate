import type {
  CertifierAssignment,
  CertifierKpis,
  DeveloperKpis,
  NotaryKpis,
  PendingDossier
} from "@plataforma/shared";
import { Router } from "express";
import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { authenticate, projectScope, requireRole } from "../middlewares/auth";

// Los paneles de rol (M2-D5 filas 33-34, 51, 55). **Paths scopeados por rol**,
// que es la forma que pide el backlog (D-066): `/developer/*`, `/notary/*`,
// `/certifier/*`.
//
// **Qué se puede calcular hoy, y qué no.** Tres entidades del modelo de M1-D2
// todavía no existen —`Unit`, `Contract`, `Dossier`— y con ellas se calculan
// varios de los KPI de las capturas. Esos van en `null`, no en cero: cero
// afirma "no hay ninguna", `null` dice "no hay con qué contarlas". El front los
// dibuja con el guión.
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
      totalUnits: null,
      capitalRaisedMinorUnits: null,
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

  const completados = stages.filter((s) => s.state === "Completed").length;

  const kpis: DeveloperKpis = {
    activeProjects: ids.length,
    // `Unit` y `Contract` no existen todavía: no hay con qué contar.
    totalUnits: null,
    capitalRaisedMinorUnits: null,
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

router.get("/notary/kpis", requireRole("admin", "notary"), async (_req, res) => {
  // **Los cuatro en null a propósito.** El dossier (M2-D4 P8) no existe como
  // entidad: no hay dossiers pendientes que contar, ni firmados, ni unidades en
  // revisión. Devolver ceros diría que el notario no tiene trabajo; `null` dice
  // que todavía no hay modelo. El panel se dibuja igual, con su empty-state.
  const kpis: NotaryKpis = {
    pendingDossiers: null,
    verified: null,
    signed: null,
    unitsUnderReview: null
  };
  return res.json(kpis);
});

router.get("/notary/dossiers/pending", requireRole("admin", "notary"), async (_req, res) => {
  return res.json([] satisfies PendingDossier[]);
});

export default router;
