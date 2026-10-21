import type { StageState } from "@plataforma/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { sembrarProyecto, sembrarStages, sembrarUnidadVendida } from "../src/db/fixtures.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import { promedio, tasa } from "../src/modules/metricas/rules.js";
import { FIXTURES } from "./global-setup.js";

const RUTA = "/api/v1/admin/document-completeness";

const login = async (f: { email: string; password: string }) =>
  (await request(app).post("/api/v1/auth/login").send(f)).body.token as string;

let tokenAdmin: string;
let investorId: string;

beforeAll(async () => {
  tokenAdmin = await login(FIXTURES.admin);
  ({ id: investorId } = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.investor.email)
    .executeTakeFirstOrThrow());
});

afterAll(async () => {
  await db.destroy();
});

/** Un proyecto propio con sus stages: `criticos` de esos, en orden, son críticos. */
async function proyecto(estados: StageState[], criticos = estados.length) {
  const slug = `spec-504-${createId()}`;
  const projectId = await sembrarProyecto(db, {
    slug,
    name: slug,
    totalUnits: 4,
    status: "in_progress"
  });
  await sembrarStages(
    db,
    projectId,
    estados.map((state, i) => ({ name: `Etapa ${i + 1}`, sequenceOrder: i + 1, state }))
  );
  await db
    .updateTable("Stage")
    .set({ validationCritical: false })
    .where("projectId", "=", projectId)
    .where("sequenceOrder", ">", criticos)
    .execute();
  return projectId;
}

async function vender(projectId: string) {
  const { unitId } = await sembrarUnidadVendida(db, {
    projectId,
    investorId,
    unitReference: `U-${createId()}`,
    floor: 1,
    sizeM2: 50,
    priceMinorUnits: 1_000_000,
    currency: "USD"
  });
  return unitId;
}

const completitud = (projectId?: string) =>
  request(app)
    .get(RUTA)
    .query(projectId ? { projectId } : {})
    .set("Authorization", `Bearer ${tokenAdmin}`);

describe("GET /admin/document-completeness (SPEC-504)", () => {
  it("todos los críticos Completed: rate 1, aunque los no críticos sigan Pending", async () => {
    const id = await proyecto(
      [...Array(7).fill("Completed"), "Pending", "Pending", "Pending"] as StageState[],
      7
    );
    const unitId = await vender(id);

    const { status, body } = await completitud(id);

    expect(status).toBe(200);
    expect(body.perUnit).toEqual([{ unitId, completedRequired: 7, totalRequired: 7, rate: 1 }]);
    expect(body.overallRate).toBe(1);
  });

  it("una unidad sin comprador no aparece en perUnit ni cuenta en overallRate", async () => {
    const id = await proyecto(["Completed", "Pending"]);
    const vendida = await vender(id);
    await db
      .insertInto("Unit")
      .values({
        id: createId(),
        projectId: id,
        unitReference: "LIBRE",
        status: "available",
        floor: null,
        sizeM2: null,
        priceMinorUnits: null,
        currency: null,
        investorId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .execute();

    const { body } = await completitud(id);

    expect(body.perUnit.map((u: { unitId: string }) => u.unitId)).toEqual([vendida]);
    expect(body.overallRate).toBe(0.5);
  });

  it("una sola unidad vendida con completitud parcial: overallRate es su rate", async () => {
    const id = await proyecto(["Completed", "InProgress", "Observed", "Pending"]);
    await vender(id);

    const { body } = await completitud(id);

    expect(body.perUnit[0].rate).toBe(0.25);
    expect(body.overallRate).toBe(body.perUnit[0].rate);
  });

  it("dos unidades al 100% y al 50%: promedio simple, 0.75", async () => {
    const entero = await proyecto(["Completed", "Completed"]);
    const mitad = await proyecto(["Completed", "Pending", "Completed", "Pending"]);
    await vender(entero);
    await vender(mitad);

    const [a, b] = await Promise.all([completitud(entero), completitud(mitad)]);

    expect(promedio([a.body.overallRate, b.body.overallRate])).toBe(0.75);
  });

  it("sin stages críticos: rate y overallRate null, no división por cero ni 100%", async () => {
    const id = await proyecto(["Completed", "Completed"], 0);
    const unitId = await vender(id);

    const { body } = await completitud(id);

    expect(body.perUnit).toEqual([{ unitId, completedRequired: 0, totalRequired: 0, rate: null }]);
    expect(body.overallRate).toBeNull();
  });

  it("un proyecto sin unidades vendidas: lista vacía y overallRate null", async () => {
    const id = await proyecto(["Completed"]);

    const { body } = await completitud(id);

    expect(body).toEqual({ perUnit: [], overallRate: null });
  });

  it("sin projectId agrega todos los proyectos", async () => {
    const id = await proyecto(["Completed"]);
    const unitId = await vender(id);

    const { body } = await completitud();

    expect(body.perUnit.map((u: { unitId: string }) => u.unitId)).toContain(unitId);
  });

  it("un no-admin recibe 403 y sin sesión 401", async () => {
    const tokenDeveloper = await login(FIXTURES.activo);

    const prohibido = await request(app).get(RUTA).set("Authorization", `Bearer ${tokenDeveloper}`);
    const anonimo = await request(app).get(RUTA);

    expect(prohibido.status).toBe(403);
    expect(anonimo.status).toBe(401);
  });

  it("un projectId mal formado es 400", async () => {
    expect((await completitud("no-es-un-id")).status).toBe(400);
  });
});

describe("las reglas de la completitud", () => {
  it("tasa sin denominador es null", () => {
    expect(tasa(0, 0)).toBeNull();
    expect(tasa(3, 4)).toBe(0.75);
  });

  it("promedio ignora las tasas null y sin ninguna da null", () => {
    expect(promedio([1, null, 0.5])).toBe(0.75);
    expect(promedio([null])).toBeNull();
    expect(promedio([])).toBeNull();
  });
});
