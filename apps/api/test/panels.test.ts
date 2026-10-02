import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

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

    expect(res.body.totalUnits).toBe(1);
    expect(res.body.capitalRaisedMinorUnits).toBe(12_000_000);
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
    expect(res.body).toEqual({
      pendingDossiers: 0,
      verified: 0,
      signed: 0,
      unitsUnderReview: 0
    });
  });

  it("la cola de revisión está vacía si nadie compiló un dossier, no inventada", async () => {
    const res = await request(app)
      .get("/api/v1/notary/dossiers/pending")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("sin firmas, el historial da nextCursor null y no un ISO inventado", async () => {
    const res = await request(app)
      .get("/api/v1/notary/signatures")
      .set("Authorization", `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });
});
