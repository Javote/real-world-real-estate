import type {
  CapitalByProject,
  CapitalMonthlyPoint,
  CapitalSummary,
  InvestorDirectoryEntry
} from "@plataforma/shared";
import { Router } from "express";
import type { UserRole } from "../db/types";
import { db } from "../lib/db";
import { authenticate, authorize, projectScope } from "../middlewares/auth";

// Capital e investors del developer (M2-D5 filas 42-43 y 48) — **M3-BE-11** y
// **M3-BE-15**.
//
// **Nada de esto es plata que se mueva** (D-021). "Capital levantado" es la
// suma de los contratos firmados y "liberado" la de los releases registrados:
// montos DECLARADOS, no fondos que la plataforma custodie o transfiera. Si el
// copy de la captura 42-43 dice otra cosa, gana esta restricción.
//
// **Las monedas no se suman entre sí.** Si los contratos de un developer
// conviven en ARS y USD, `currency` viaja `null` y el total es la suma cruda:
// convertir con una cotización inventada sería afirmar algo que no podemos
// sustanciar (regla 17). El cliente muestra el guión de `panel.emptyValue`
// cuando no hay una moneda única.

const router = Router();

router.use(authenticate);

/** Los ids de los proyectos donde el usuario es developer. */
async function misProyectoIds(userId: string, role: UserRole): Promise<string[]> {
  const filas = await db
    .selectFrom("Project")
    .select("id")
    .where((eb) => projectScope(eb, role, userId, ["developer"]))
    .execute();
  return filas.map((f) => f.id);
}

/** Una sola moneda, o `null` si conviven varias. */
function monedaUnica(valores: (string | null)[]): string | null {
  const distintas = new Set(valores.filter((v): v is string => v !== null));
  return distintas.size === 1 ? [...distintas][0] : null;
}

/** Contratos + releases de un conjunto de proyectos, en una sola pasada. */
async function movimientos(projectIds: string[]) {
  if (projectIds.length === 0) return { contratos: [], releases: [] };

  const contratos = await db
    .selectFrom("Contract")
    .innerJoin("Unit", "Unit.id", "Contract.unitId")
    .select([
      "Contract.id as id",
      "Contract.totalMinorUnits as totalMinorUnits",
      "Contract.currency as currency",
      "Contract.investorId as investorId",
      "Contract.createdAt as createdAt",
      "Unit.id as unitId",
      "Unit.projectId as projectId"
    ])
    .where("Unit.projectId", "in", projectIds)
    .execute();

  const releases =
    contratos.length === 0
      ? []
      : await db
          .selectFrom("PaymentAttestation")
          .innerJoin("Contract", "Contract.id", "PaymentAttestation.contractId")
          .innerJoin("Unit", "Unit.id", "Contract.unitId")
          .select([
            "PaymentAttestation.amountMinorUnits as amountMinorUnits",
            "PaymentAttestation.releasedAt as releasedAt",
            "Unit.projectId as projectId"
          ])
          .where("Unit.projectId", "in", projectIds)
          .execute();

  return { contratos, releases };
}

/** `YYYY-MM` en UTC (regla 1): el mes no depende del huso de quien mira. */
function mesUtc(fecha: Date | number): string {
  const d = new Date(fecha);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Fila 42-43 — los tres StatCard de la cabecera. */
router.get(
  "/capital/summary",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res) => {
    const ids = await misProyectoIds(req.user!.id, req.user!.role);
    const { contratos, releases } = await movimientos(ids);

    const raised = contratos.reduce((acc, c) => acc + c.totalMinorUnits, 0);
    const released = releases.reduce((acc, r) => acc + r.amountMinorUnits, 0);

    const resumen: CapitalSummary = {
      raisedMinorUnits: raised,
      releasedMinorUnits: released,
      // No puede ser negativo: liberar más de lo contratado no es un estado
      // alcanzable, pero si lo fuera el piso es cero y no un número absurdo.
      pendingMinorUnits: Math.max(raised - released, 0),
      contracts: contratos.length,
      currency: monedaUnica(contratos.map((c) => c.currency))
    };

    return res.json(resumen);
  }
);

/**
 * Fila 42-43 — la serie mensual del Chart.
 *
 * **Solo los meses con movimiento.** Rellenar los vacíos con ceros dibujaría
 * una serie continua donde no hay dato, y el eje del gráfico lo decide el
 * cliente, que es quien sabe qué ventana está mostrando.
 */
router.get(
  "/capital/monthly",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res) => {
    const ids = await misProyectoIds(req.user!.id, req.user!.role);
    const { contratos, releases } = await movimientos(ids);

    const porMes = new Map<string, CapitalMonthlyPoint>();
    const acumular = (mes: string) =>
      porMes.get(mes) ?? { month: mes, raisedMinorUnits: 0, releasedMinorUnits: 0 };

    for (const c of contratos) {
      const mes = mesUtc(c.createdAt);
      const punto = acumular(mes);
      punto.raisedMinorUnits += c.totalMinorUnits;
      porMes.set(mes, punto);
    }
    for (const r of releases) {
      const mes = mesUtc(r.releasedAt);
      const punto = acumular(mes);
      punto.releasedMinorUnits += r.amountMinorUnits;
      porMes.set(mes, punto);
    }

    const serie = [...porMes.values()].sort((a, b) => a.month.localeCompare(b.month));
    return res.json(serie);
  }
);

/** Fila 42-43 — el desglose por proyecto, con la barra de ocupación. */
router.get(
  "/capital/by-project",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res) => {
    const ids = await misProyectoIds(req.user!.id, req.user!.role);
    if (ids.length === 0) return res.json([]);

    const [proyectos, unidades, { contratos, releases }] = await Promise.all([
      db.selectFrom("Project").select(["id", "name"]).where("id", "in", ids).execute(),
      db
        .selectFrom("Unit")
        .select(["id", "projectId", "investorId"])
        .where("projectId", "in", ids)
        .execute(),
      movimientos(ids)
    ]);

    const desglose: CapitalByProject[] = proyectos.map((p) => {
      const delProyecto = contratos.filter((c) => c.projectId === p.id);
      const unidadesDel = unidades.filter((u) => u.projectId === p.id);

      return {
        projectId: p.id,
        projectName: p.name,
        raisedMinorUnits: delProyecto.reduce((acc, c) => acc + c.totalMinorUnits, 0),
        releasedMinorUnits: releases
          .filter((r) => r.projectId === p.id)
          .reduce((acc, r) => acc + r.amountMinorUnits, 0),
        unitsSold: unidadesDel.filter((u) => u.investorId !== null).length,
        totalUnits: unidadesDel.length,
        // Distintos, no contratos: quien compra dos unidades es un investor.
        investors: new Set(delProyecto.map((c) => c.investorId)).size,
        currency: monedaUnica(delProyecto.map((c) => c.currency))
      };
    });

    return res.json(desglose);
  }
);

/**
 * Fila 48 — el directorio de investors — **M3-BE-15**.
 *
 * El developer ve el nombre y el mail de quien compró en SUS proyectos, y de
 * nadie más: es la contraparte de una operación suya. Ese recorte es la
 * autorización acá, y sale del `in (misProyectos)` de la query — no de un
 * filtro en memoria que se pueda saltear.
 */
router.get(
  "/investors",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res) => {
    const ids = await misProyectoIds(req.user!.id, req.user!.role);
    if (ids.length === 0) return res.json([]);

    const filas = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .innerJoin("Project", "Project.id", "Unit.projectId")
      .innerJoin("User", "User.id", "Contract.investorId")
      .select([
        "User.id as id",
        "User.fullName as fullName",
        "User.email as email",
        "Contract.totalMinorUnits as totalMinorUnits",
        "Contract.currency as currency",
        "Project.name as projectName"
      ])
      .where("Unit.projectId", "in", ids)
      .execute();

    const porInvestor = new Map<string, InvestorDirectoryEntry & { monedas: (string | null)[] }>();

    for (const fila of filas) {
      const actual = porInvestor.get(fila.id) ?? {
        id: fila.id,
        fullName: fila.fullName,
        email: fila.email,
        units: 0,
        investedMinorUnits: 0,
        currency: null,
        projects: [],
        monedas: []
      };

      actual.units += 1;
      actual.investedMinorUnits += fila.totalMinorUnits;
      actual.monedas.push(fila.currency);
      if (!actual.projects.includes(fila.projectName)) actual.projects.push(fila.projectName);

      porInvestor.set(fila.id, actual);
    }

    const directorio: InvestorDirectoryEntry[] = [...porInvestor.values()].map(
      ({ monedas, ...entrada }) => ({ ...entrada, currency: monedaUnica(monedas) })
    );

    return res.json(directorio);
  }
);

export default router;
