import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

// SPEC-018 A3 — `capital.routes.ts`. `capital.test.ts` fija los totales
// exactos contra la plantilla, que tiene un solo contrato y ninguna
// liberación: con eso nunca corrieron los `reduce` de las liberaciones, el
// orden por mes, ni el investor con dos unidades del mismo proyecto. Este
// archivo arma ese estado en su propia base, sin tocar los números de aquel.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

const TORRE = "Torre Test";
const CONTRATO_FIXTURE = 12_000_000;
const SEGUNDO_CONTRATO = 3_000_000;
const LIBERADO = 1_000_000;
// Un mes que ningún `createdAt` de la suite puede caer: el de la liberación.
const MES_DE_LA_LIBERACION = "2025-01";

let tokenDev: string;
let tokenAjeno: string;
let tokenDevSinContratos: string;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAjeno = (await login(FIXTURES.ajeno)).body.token;
  const tokenAdmin = (await login(FIXTURES.admin)).body.token;
  const tokenInvestor = (await login(FIXTURES.investor)).body.token;

  const proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  const actorId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;

  // El mismo investor de la plantilla compra una segunda unidad del mismo
  // proyecto: dos contratos, un proyecto.
  const unidad = await request(app)
    .post(`/api/v1/developer/projects/${proyecto}/units`)
    .set("Authorization", `Bearer ${tokenDev}`)
    .send({ unitReference: "CAP2", priceMinorUnits: SEGUNDO_CONTRATO, currency: "USD" });
  const invitacion = await request(app)
    .post(`/api/v1/developer/projects/${proyecto}/invitations`)
    .set("Authorization", `Bearer ${tokenDev}`)
    .send({
      unitId: unidad.body.id,
      investorEmail: FIXTURES.investor.email,
      amountMinorUnits: SEGUNDO_CONTRATO,
      currency: "USD"
    });
  const aceptada = await request(app)
    .post(`/api/v1/investor/invitations/${invitacion.body.id}/accept`)
    .set("Authorization", `Bearer ${tokenInvestor}`);
  expect(aceptada.status).toBe(201);
  const contractId = aceptada.body.contract.id as string;

  // Una liberación real: etapa certificada y `POST …/releases/:stageNum`.
  const sequenceOrder = 900_901;
  const stage = await crearStageMinteado({
    projectId: proyecto,
    name: "Etapa capital",
    sequenceOrder,
    validationCritical: false,
    actorUserId: actorId
  });
  for (const [estado, actor] of [
    ["InProgress", tokenDev],
    ["Completed", tokenAdmin]
  ] as const) {
    await request(app)
      .patch(`/api/v1/stages/${stage.id}/state`)
      .set("Authorization", `Bearer ${actor}`)
      .send({ state: estado });
  }
  const liberacion = await request(app)
    .post(`/api/v1/developer/contracts/${contractId}/releases/${sequenceOrder}`)
    .set("Authorization", `Bearer ${tokenDev}`)
    .send({ amountMinorUnits: LIBERADO });
  expect(liberacion.status).toBe(201);

  // La liberación se corre a otro mes para que la serie tenga dos puntos que
  // ordenar: en el flujo real todo pasa en el mismo instante.
  await db
    .updateTable("PaymentAttestation")
    .set({ releasedAt: new Date(`${MES_DE_LA_LIBERACION}-15T12:00:00Z`) })
    .where("contractId", "=", contractId)
    .execute();

  // Un developer con un proyecto propio y ningún contrato.
  const email = `dev-capital-${createId()}@test.local`;
  const creado = await request(app)
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ email, password: "capital12345", role: "developer", fullName: "Dev Capital" });
  expect(creado.status).toBe(201);
  const proyectoVacio = createId();
  const ahora = new Date();
  await db
    .insertInto("Project")
    .values({
      id: proyectoVacio,
      name: "Sin ventas",
      slug: `sin-ventas-${proyectoVacio}`,
      totalUnits: 0,
      status: "planning",
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  await db
    .insertInto("ProjectMember")
    .values({
      id: createId(),
      userId: creado.body.id,
      projectId: proyectoVacio,
      membershipRole: "developer",
      createdAt: ahora
    })
    .execute();
  tokenDevSinContratos = (await login({ email, password: "capital12345" })).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /developer/capital/summary", () => {
  it("resta lo liberado de lo recaudado", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/summary")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      raisedMinorUnits: CONTRATO_FIXTURE + SEGUNDO_CONTRATO,
      releasedMinorUnits: LIBERADO,
      pendingMinorUnits: CONTRATO_FIXTURE + SEGUNDO_CONTRATO - LIBERADO,
      contracts: 2,
      currency: "USD"
    });
  });

  it("un proyecto propio sin contratos da ceros sin ir a buscar liberaciones", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/summary")
      .set("Authorization", `Bearer ${tokenDevSinContratos}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      raisedMinorUnits: 0,
      releasedMinorUnits: 0,
      pendingMinorUnits: 0,
      contracts: 0,
      currency: null
    });
  });
});

describe("GET /developer/capital/monthly", () => {
  it("pone la liberación en su mes y ordena la serie de menor a mayor", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/monthly")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    const meses = res.body.map((p: { month: string }) => p.month);
    expect(meses.length).toBeGreaterThanOrEqual(2);
    expect(meses).toEqual([...meses].sort());
    expect(res.body[0]).toEqual({
      month: MES_DE_LA_LIBERACION,
      raisedMinorUnits: 0,
      releasedMinorUnits: LIBERADO
    });
  });
});

describe("GET /developer/capital/by-project", () => {
  it("suma las liberaciones del proyecto y cuenta al investor una sola vez", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/by-project")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    const torre = res.body.find((p: { projectName: string }) => p.projectName === TORRE);
    expect(torre).toMatchObject({
      raisedMinorUnits: CONTRATO_FIXTURE + SEGUNDO_CONTRATO,
      releasedMinorUnits: LIBERADO,
      unitsSold: 2,
      investors: 1
    });
  });

  it("un developer sin proyectos recibe la lista vacía", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/by-project")
      .set("Authorization", `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /developer/investors", () => {
  it("dos unidades del mismo proyecto: dos unidades, un proyecto", async () => {
    const res = await request(app)
      .get("/api/v1/developer/investors")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    const investor = res.body.find((i: { email: string }) => i.email === FIXTURES.investor.email);
    expect(investor).toMatchObject({
      units: 2,
      investedMinorUnits: CONTRATO_FIXTURE + SEGUNDO_CONTRATO,
      projects: [TORRE]
    });
  });
});
