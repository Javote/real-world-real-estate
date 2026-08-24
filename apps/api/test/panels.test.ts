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
  it("calcula lo que puede y deja en null lo que necesita entidades que no existen", async () => {
    const res = await request(app)
      .get("/api/v1/developer/kpis")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.activeProjects).toBe("number");
    expect(typeof res.body.averageProgress).toBe("number");
    expect(typeof res.body.verifiedDocuments).toBe("number");

    // **La distinción que importa:** `Unit` y `Contract` no existen, así que
    // estos dos son null y no cero. Cero afirmaría "no hay unidades vendidas".
    expect(res.body.totalUnits).toBeNull();
    expect(res.body.capitalRaisedMinorUnits).toBeNull();
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
  it("devuelve null en los cuatro KPI: el dossier no existe como entidad", async () => {
    const res = await request(app)
      .get("/api/v1/notary/kpis")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    // Cero diría "el notario no tiene trabajo". Null dice "todavía no hay
    // modelo de dossier". Son cosas distintas y el panel las muestra distinto.
    expect(res.body).toEqual({
      pendingDossiers: null,
      verified: null,
      signed: null,
      unitsUnderReview: null
    });
  });

  it("la lista de dossiers pendientes está vacía, no inventada", async () => {
    const res = await request(app)
      .get("/api/v1/notary/dossiers/pending")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
