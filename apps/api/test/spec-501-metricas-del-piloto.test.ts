import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { sembrarProyecto, sembrarStages, sembrarUnidadVendida } from "../src/db/fixtures.js";
import { createId } from "../src/db/id.js";
import { db } from "../src/lib/db.js";
import * as encuestas from "../src/modules/encuestas/casos.js";
import { FIXTURES } from "./global-setup.js";

const RUTA = "/api/v1/admin/pilot-metrics";

const login = async (f: { email: string; password: string }) =>
  (await request(app).post("/api/v1/auth/login").send(f)).body.token as string;

let tokenAdmin: string;
let investorId: string;
let lleno: string;
let vacio: string;

async function proyecto(nombre: string) {
  const slug = `spec-501-${createId()}`;
  return sembrarProyecto(db, { slug, name: nombre, totalUnits: 2, status: "in_progress" });
}

beforeAll(async () => {
  tokenAdmin = await login(FIXTURES.admin);
  ({ id: investorId } = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.investor.email)
    .executeTakeFirstOrThrow());

  lleno = await proyecto("A Piloto lleno");
  vacio = await proyecto("B Piloto vacío");
  await sembrarStages(db, lleno, [
    { name: "Fundaciones", sequenceOrder: 1, state: "Completed" },
    { name: "Estructura", sequenceOrder: 2, state: "Pending" }
  ]);
  const [stage] = await db
    .selectFrom("Stage")
    .select("id")
    .where("projectId", "=", lleno)
    .orderBy("sequenceOrder")
    .execute();

  const vender = (unitReference: string, priceMinorUnits: number, currency: string) =>
    sembrarUnidadVendida(db, {
      projectId: lleno,
      investorId,
      unitReference,
      floor: 1,
      sizeM2: 50,
      priceMinorUnits,
      currency
    });
  const { contractId, unitId } = await vender("P-1", 10_000_000, "USD");
  await vender("P-2", 5_000_000, "USD");
  await vender("P-3", 900_000_000, "ARS");

  await db
    .insertInto("EvidenceBundle")
    .values({
      id: createId(),
      projectId: lleno,
      stageId: stage!.id,
      commitmentHash: "ab".repeat(32),
      createdById: null,
      createdAt: new Date()
    })
    .execute();
  await db
    .insertInto("PaymentAttestation")
    .values({
      id: createId(),
      contractId,
      stageNumber: 1,
      amountMinorUnits: 1_000_000,
      releasedById: null,
      releasedAt: Date.now()
    })
    .execute();
  await db
    .insertInto("Dispute")
    .values({
      id: createId(),
      stageId: stage!.id,
      projectId: lleno,
      openedById: investorId,
      reason: "Reclamo",
      status: "Open",
      outcome: null,
      resolution: null,
      resolvedById: null,
      createdAt: new Date(),
      resolvedAt: null
    })
    .execute();
  await encuestas.enviarPorPrimeraLiberacion(
    { db, clock: () => new Date() },
    { investorId, projectId: lleno, unitId }
  );
  const { token } = await db
    .selectFrom("NpsSurvey")
    .select("token")
    .where("projectId", "=", lleno)
    .executeTakeFirstOrThrow();
  await encuestas.responder(
    { db, clock: () => new Date() },
    { token, score: 10, comment: undefined }
  );
});

afterAll(async () => {
  await db.destroy();
});

const metricas = (query: object = {}, token = tokenAdmin) =>
  request(app).get(RUTA).query(query).set("Authorization", `Bearer ${token}`);

describe("GET /admin/pilot-metrics (SPEC-501)", () => {
  it("agrega los ocho números por proyecto, con su fórmula", async () => {
    const { status, body } = await metricas({ projectIds: `${lleno},${vacio}` });

    expect(status).toBe(200);
    expect(body.perProject.map((p: { projectName: string }) => p.projectName)).toEqual([
      "A Piloto lleno",
      "B Piloto vacío"
    ]);
    expect(body.perProject[0]).toMatchObject({
      projectId: lleno,
      signedContractsCount: 3,
      evidenceBundlesCount: 1,
      releasesCount: 1,
      uniqueWalletsCount: null,
      documentCompletenessRate: 0.5,
      disputesCount: 1,
      disputeRate: 1,
      nps: { promoters: 1, responseCount: 1, sentCount: 1, score: 100, belowMinimum: true }
    });
  });

  it("dos monedas no se suman entre sí: el valor declarado va desglosado", async () => {
    const { body } = await metricas({ projectIds: lleno });

    expect(body.total.declaredValueByCurrency).toEqual([
      { currency: "ARS", totalMinorUnits: 900_000_000 },
      { currency: "USD", totalMinorUnits: 15_000_000 }
    ]);
  });

  it("un proyecto sin nada cuenta 0, y sus tasas son null, no 0", async () => {
    const { body } = await metricas({ projectIds: vacio });

    expect(body.total).toEqual({
      signedContractsCount: 0,
      evidenceBundlesCount: 0,
      releasesCount: 0,
      uniqueWalletsCount: null,
      declaredValueByCurrency: [],
      documentCompletenessRate: null,
      disputesCount: 0,
      disputeRate: null,
      nps: expect.objectContaining({ responseCount: 0, sentCount: 0, score: null })
    });
  });

  it("el total del filtro se calcula aparte, no sumando las tasas de los proyectos", async () => {
    const { body } = await metricas({ projectIds: `${lleno},${vacio}` });

    expect(body.total.signedContractsCount).toBe(3);
    expect(body.total.documentCompletenessRate).toBe(0.5);
    expect(body.total.disputeRate).toBe(1);
  });

  it("sin filtro agrega todos los proyectos", async () => {
    const { body } = await metricas();

    expect(body.perProject.map((p: { projectId: string }) => p.projectId)).toEqual(
      expect.arrayContaining([lleno, vacio])
    );
    expect(body.total.signedContractsCount).toBeGreaterThanOrEqual(3);
  });

  it("un no-admin es 403 y una lista mal formada es 400", async () => {
    expect((await metricas({}, await login(FIXTURES.activo))).status).toBe(403);
    expect((await metricas({ projectIds: `${lleno}, ${vacio}` })).status).toBe(400);
  });
});
