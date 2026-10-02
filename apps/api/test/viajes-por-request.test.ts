import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";
import { medirViajes } from "./helpers/viajes";

const token = async (email: string, password: string) => {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  return res.body.token as string;
};

let developer: string;
let investor: string;
let proyecto: string;
let stage: string;
let contrato: string;

beforeAll(async () => {
  developer = await token(FIXTURES.activo.email, FIXTURES.activo.password);
  investor = await token(FIXTURES.investor.email, FIXTURES.investor.password);

  const dev = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.activo.email)
    .executeTakeFirstOrThrow();
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  stage = (
    await crearStageMinteado({
      projectId: proyecto,
      name: "Viajes",
      sequenceOrder: 900,
      actorUserId: dev.id
    })
  ).id;

  const dueño = await db
    .selectFrom("User")
    .select("id")
    .where("email", "=", FIXTURES.investor.email)
    .executeTakeFirstOrThrow();
  const ahora = new Date();
  const unidad = createId();
  await db
    .insertInto("Unit")
    .values({
      id: unidad,
      projectId: proyecto,
      unitReference: "VIAJES-1",
      status: "sold",
      priceMinorUnits: 1_000_000,
      currency: "USD",
      investorId: dueño.id,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  contrato = createId();
  await db
    .insertInto("Contract")
    .values({
      id: contrato,
      unitId: unidad,
      investorId: dueño.id,
      totalMinorUnits: 1_000_000,
      currency: "USD",
      signedAt: ahora,
      createdAt: ahora
    })
    .execute();
});

afterAll(async () => {
  await db.destroy();
});

type Caso = {
  ruta: string;
  enSerie: number;
  pedir: () => request.Test;
};

const CASOS: Caso[] = [
  {
    ruta: "GET /auth/me",
    enSerie: 2,
    pedir: () => request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${developer}`)
  },
  {
    ruta: "GET /projects",
    enSerie: 3,
    pedir: () => request(app).get("/api/v1/projects").set("Authorization", `Bearer ${developer}`)
  },
  {
    ruta: "GET /projects/:id",
    enSerie: 2,
    pedir: () =>
      request(app).get(`/api/v1/projects/${proyecto}`).set("Authorization", `Bearer ${developer}`)
  },
  {
    ruta: "GET /projects/:id/stages",
    enSerie: 3,
    pedir: () =>
      request(app)
        .get(`/api/v1/projects/${proyecto}/stages`)
        .set("Authorization", `Bearer ${developer}`)
  },
  {
    ruta: "GET /stages/:id",
    enSerie: 2,
    pedir: () =>
      request(app).get(`/api/v1/stages/${stage}`).set("Authorization", `Bearer ${developer}`)
  },
  {
    ruta: "PATCH /stages/:id",
    enSerie: 3,
    pedir: () =>
      request(app)
        .patch(`/api/v1/stages/${stage}`)
        .set("Authorization", `Bearer ${developer}`)
        .send({ name: "Viajes renombrada" })
  },
  {
    ruta: "GET /investor/units",
    enSerie: 3,
    pedir: () =>
      request(app).get("/api/v1/investor/units").set("Authorization", `Bearer ${investor}`)
  },
  {
    ruta: "GET /contracts/:id/releases (regla `alguna`)",
    enSerie: 4,
    pedir: () =>
      request(app)
        .get(`/api/v1/contracts/${contrato}/releases`)
        .set("Authorization", `Bearer ${investor}`)
  },
  {
    ruta: "GET /notifications/unread-count",
    enSerie: 2,
    pedir: () =>
      request(app)
        .get("/api/v1/notifications/unread-count")
        .set("Authorization", `Bearer ${developer}`)
  }
];

describe("consultas lanzadas juntas", () => {
  it("van en paralelo: sin el mutex de conexión del `SqliteAdapter` de Kysely", async () => {
    const medida = await medirViajes(() =>
      Promise.all([
        db.selectFrom("User").select("id").execute(),
        db.selectFrom("Project").select("id").execute(),
        db.selectFrom("Stage").select("id").execute()
      ])
    );

    expect(medida.consultas).toBe(3);
    expect(medida.enSerie).toBe(1);
  });

  it("dos requests simultáneas no se turnan: cada una paga solo sus viajes", async () => {
    const medida = await medirViajes(() =>
      Promise.all([
        request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${developer}`),
        request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${developer}`)
      ])
    );

    expect(medida.consultas).toBe(4);
    expect(medida.enSerie).toBe(2);
  });
});

describe("viajes a la base en serie por request (SPEC-610)", () => {
  it.each(CASOS)("$ruta: $enSerie", async ({ enSerie, pedir }) => {
    let status = 0;
    const medida = await medirViajes(async () => {
      status = (await pedir()).status;
    });
    expect(status).toBeLessThan(300);
    expect(medida.enSerie).toBe(enSerie);
  });
});
