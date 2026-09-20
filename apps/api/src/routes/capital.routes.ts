import {
  capitalByProjectSchema,
  capitalMonthlyPointSchema,
  capitalSummarySchema,
  type InvestorDirectoryEntry,
  investorDirectoryEntrySchema
} from "@plataforma/shared";
import { Router } from "express";
import { z } from "zod";
import type { UserRole } from "../db/types";
import { en } from "../lib/arrays";
import { db } from "../lib/db";
import { OpenAPIHandler, os } from "../lib/orpc";
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
//
// **SPEC-212 §D — migrado a oRPC (D-066), última de las cuatro sub-partes.**
// Las cuatro son GET sin body, así que no hay error de negocio que nombrar —
// mismo patrón de montaje que el resto del prefijo (`OpenAPIHandler` por
// procedimiento, `authorize` sin cambios).

const PREFIJO_ABSOLUTO = "/api/v1/developer";

type DeveloperContext = { user: { id: string; role: UserRole } };
const orpc = os.$context<DeveloperContext>();

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
  return distintas.size === 1 ? en([...distintas], 0) : null;
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
const summaryProcedure = orpc
  .route({ method: "GET", path: "/capital/summary" })
  .output(capitalSummarySchema)
  .handler(async ({ context }) => {
    const ids = await misProyectoIds(context.user.id, context.user.role);
    const { contratos, releases } = await movimientos(ids);

    const raised = contratos.reduce((acc, c) => acc + c.totalMinorUnits, 0);
    const released = releases.reduce((acc, r) => acc + r.amountMinorUnits, 0);

    return {
      raisedMinorUnits: raised,
      releasedMinorUnits: released,
      // No puede ser negativo: liberar más de lo contratado no es un estado
      // alcanzable, pero si lo fuera el piso es cero y no un número absurdo.
      pendingMinorUnits: Math.max(raised - released, 0),
      contracts: contratos.length,
      currency: monedaUnica(contratos.map((c) => c.currency))
    };
  });
const summaryHandler = new OpenAPIHandler({ summaryProcedure });

router.get(
  "/capital/summary",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res, next) => {
    const { matched } = await summaryHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/**
 * Fila 42-43 — la serie mensual del Chart.
 *
 * **Solo los meses con movimiento.** Rellenar los vacíos con ceros dibujaría
 * una serie continua donde no hay dato, y el eje del gráfico lo decide el
 * cliente, que es quien sabe qué ventana está mostrando.
 */
const monthlyProcedure = orpc
  .route({ method: "GET", path: "/capital/monthly" })
  .output(z.array(capitalMonthlyPointSchema))
  .handler(async ({ context }) => {
    const ids = await misProyectoIds(context.user.id, context.user.role);
    const { contratos, releases } = await movimientos(ids);

    const porMes = new Map<string, z.infer<typeof capitalMonthlyPointSchema>>();
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

    return [...porMes.values()].sort((a, b) => a.month.localeCompare(b.month));
  });
const monthlyHandler = new OpenAPIHandler({ monthlyProcedure });

router.get(
  "/capital/monthly",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res, next) => {
    const { matched } = await monthlyHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** Fila 42-43 — el desglose por proyecto, con la barra de ocupación. */
const byProjectProcedure = orpc
  .route({ method: "GET", path: "/capital/by-project" })
  .output(z.array(capitalByProjectSchema))
  .handler(async ({ context }) => {
    const ids = await misProyectoIds(context.user.id, context.user.role);
    if (ids.length === 0) return [];

    const [proyectos, unidades, { contratos, releases }] = await Promise.all([
      db.selectFrom("Project").select(["id", "name"]).where("id", "in", ids).execute(),
      db
        .selectFrom("Unit")
        .select(["id", "projectId", "investorId"])
        .where("projectId", "in", ids)
        .execute(),
      movimientos(ids)
    ]);

    return proyectos.map((p) => {
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
  });
const byProjectHandler = new OpenAPIHandler({ byProjectProcedure });

router.get(
  "/capital/by-project",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res, next) => {
    const { matched } = await byProjectHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
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
const investorsProcedure = orpc
  .route({ method: "GET", path: "/investors" })
  .output(z.array(investorDirectoryEntrySchema))
  .handler(async ({ context }) => {
    const ids = await misProyectoIds(context.user.id, context.user.role);
    if (ids.length === 0) return [];

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

    return [...porInvestor.values()].map(({ monedas, ...entrada }) => ({
      ...entrada,
      currency: monedaUnica(monedas)
    }));
  });
const investorsHandler = new OpenAPIHandler({ investorsProcedure });

router.get(
  "/investors",
  authorize({ roles: ["admin", "developer"], acceso: { scopeEnQuery: "projectScope(developer)" } }),
  async (req, res, next) => {
    const { matched } = await investorsHandler.handle(req, res, {
      prefix: PREFIJO_ABSOLUTO,
      context: { user: req.user! }
    });
    if (!matched) next();
  }
);

/** El router oRPC combinado de esta vertical — ver el comentario homólogo en
 * `developer.routes.ts`. */
export const capitalOrpcRouter = {
  summaryProcedure,
  monthlyProcedure,
  byProjectProcedure,
  investorsProcedure
};

export default router;
