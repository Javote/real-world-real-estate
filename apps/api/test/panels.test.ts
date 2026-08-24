import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// M2-D5 filas 33-34, 51 y 55. Lo que estos tests fijan no son los números:
// es **que ningún panel invente uno**.

let tokenDev: string;
let tokenAdmin: string;

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAdmin = (await login(FIXTURES.admin)).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /developer/kpis", () => {
  it("cuenta unidades y capital de las entidades reales, sin inventar nada", async () => {
    const res = await request(app)
      .get("/api/v1/developer/kpis")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.activeProjects).toBe("number");
    expect(typeof res.body.averageProgress).toBe("number");
    expect(typeof res.body.verifiedDocuments).toBe("number");

    // `Unit` y `Contract` ya existen, así que estos dos se cuentan de verdad.
    // El piso es lo que planta el fixture —una unidad, un contrato— y no un
    // total exacto: la suite comparte una base y otros archivos crean unidades
    // sobre el mismo proyecto mientras este test corre.
    expect(res.body.totalUnits).toBeGreaterThanOrEqual(1);
    expect(res.body.capitalRaisedMinorUnits).toBeGreaterThanOrEqual(12_000_000);
  });

  it("el avance promedio está entre 0 y 100", async () => {
    const res = await request(app)
      .get("/api/v1/developer/kpis")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.body.averageProgress).toBeGreaterThanOrEqual(0);
    expect(res.body.averageProgress).toBeLessThanOrEqual(100);
  });

  it("403 para un rol que no es developer ni admin", async () => {
    const tokenBuyer = (await login({ email: "buyer@test.local", password: "x" })).body.token;
    const res = await request(app)
      .get("/api/v1/developer/kpis")
      .set("Authorization", `Bearer ${tokenBuyer ?? "sin-token"}`);

    expect([401, 403]).toContain(res.status);
  });
});

describe("GET /certifier/kpis y /certifier/assignments", () => {
  it("los KPI del certifier salen de los stages reales", async () => {
    const res = await request(app)
      .get("/api/v1/certifier/kpis")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    // La suma de los tres estados no puede pasar el total.
    expect(res.body.assigned + res.body.certified + res.body.observed).toBeLessThanOrEqual(
      res.body.totalStages
    );
  });

  it("las asignaciones son stages en curso u observados, con su proyecto", async () => {
    const res = await request(app)
      .get("/api/v1/certifier/assignments")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const fila of res.body) {
      expect(fila).toHaveProperty("stageId");
      expect(fila).toHaveProperty("projectName");
      expect(fila).toHaveProperty("stageName");
    }
  });
});

describe("GET /notary/*", () => {
  it("cuenta los dossiers reales, y cero es cero de verdad", async () => {
    const res = await request(app)
      .get("/api/v1/notary/kpis")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    // Antes los cuatro eran `null` porque `Dossier` no existía. Ahora existe y
    // se cuentan de verdad; la distinción null/cero sigue viva en el schema,
    // que es donde importa.
    //
    // **No se afirman valores exactos a propósito:** la suite comparte una
    // sola base, y `dossier.test.ts` compila y firma un dossier. Fijar ceros
    // acá haría que este test dependa del orden de los archivos, que es
    // justamente el tipo de verde frágil que no queremos.
    for (const kpi of ["pendingDossiers", "verified", "signed", "unitsUnderReview"]) {
      expect(typeof res.body[kpi]).toBe("number");
      expect(res.body[kpi]).toBeGreaterThanOrEqual(0);
    }

    const total = await db
      .selectFrom("Dossier")
      .select((eb) => eb.fn.countAll<number>().as("total"))
      .executeTakeFirstOrThrow();

    // Pendiente + resuelto = todos: ningún dossier se cuenta dos veces ni se
    // pierde.
    expect(res.body.pendingDossiers + res.body.verified).toBe(Number(total.total));
    expect(res.body.signed).toBeLessThanOrEqual(res.body.verified);
  });

  it("la cola de revisión trae solo dossiers compilados, con su completitud real", async () => {
    const res = await request(app)
      .get("/api/v1/notary/dossiers/pending")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    for (const pendiente of res.body) {
      expect(pendiente.completeness).toBeGreaterThanOrEqual(0);
      expect(pendiente.completeness).toBeLessThanOrEqual(100);
      // Un dossier firmado no está pendiente de revisión.
      const fila = await db
        .selectFrom("Dossier")
        .select("status")
        .where("id", "=", pendiente.dossierId)
        .executeTakeFirstOrThrow();
      expect(fila.status).toBe("compiled");
    }
  });
});
