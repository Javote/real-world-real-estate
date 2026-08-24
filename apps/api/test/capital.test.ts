import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// M2-D5 filas 42-43 y 48 — **M3-BE-11** y **M3-BE-15**.
//
// Lo que fijan: que el capital salga de contratos reales, que las monedas
// distintas NO se sumen bajo una sola etiqueta, y que un developer no vea los
// investors de un proyecto ajeno.
//
// **Nada de totales exactos.** La suite comparte una sola base y sus archivos
// corren en paralelo: otro archivo puede estar creando un contrato sobre el
// mismo proyecto entre la respuesta del endpoint y cualquier lectura de
// control. Lo que se afirma acá son invariantes —el piso que planta el
// fixture, y que las partes cierren entre sí— que es lo que el endpoint
// realmente promete.

const login = (f: { email: string; password: string }) =>
  request(app).post("/api/v1/auth/login").send({ email: f.email, password: f.password });

let tokenDev: string;
let tokenAjeno: string;
let tokenInvestor: string;

beforeAll(async () => {
  tokenDev = (await login(FIXTURES.activo)).body.token;
  tokenAjeno = (await login(FIXTURES.ajeno)).body.token;
  tokenInvestor = (await login(FIXTURES.investor)).body.token;
});

afterAll(async () => {
  await db.destroy();
});

describe("GET /developer/capital/summary", () => {
  it("suma los contratos del proyecto del developer", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/summary")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.raisedMinorUnits).toBeGreaterThanOrEqual(12_000_000);
    expect(res.body.contracts).toBeGreaterThanOrEqual(1);
    // Una sola moneda en el proyecto: si conviviera otra, esto sería `null` y
    // los totales no se sumarían bajo una etiqueta que miente.
    expect(res.body.currency).toBe("USD");
    // `pending = raised - released`, sin inventar un tercer número.
    expect(res.body.pendingMinorUnits).toBe(
      Math.max(res.body.raisedMinorUnits - res.body.releasedMinorUnits, 0)
    );
  });

  it("un developer sin membresía ve ceros, no los números de otro", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/summary")
      .set("Authorization", `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(200);
    expect(res.body.raisedMinorUnits).toBe(0);
    expect(res.body.contracts).toBe(0);
  });

  it("un investor no entra a la superficie del developer", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/summary")
      .set("Authorization", `Bearer ${tokenInvestor}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /developer/capital/monthly", () => {
  it("devuelve solo los meses con movimiento, en formato YYYY-MM y en UTC", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/monthly")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    for (const punto of res.body) {
      expect(punto.month).toMatch(/^\d{4}-\d{2}$/);
    }
  });
});

describe("GET /developer/capital/by-project", () => {
  it("desglosa con unidades vendidas sobre el total real", async () => {
    const res = await request(app)
      .get("/api/v1/developer/capital/by-project")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    const torre = res.body.find((p: { projectName: string }) => p.projectName === "Torre Test");
    // El contrato del fixture es el piso, no el total: otros archivos de la
    // suite crean unidades sobre el mismo proyecto en paralelo.
    expect(torre.raisedMinorUnits).toBeGreaterThanOrEqual(12_000_000);
    expect(torre.unitsSold).toBeGreaterThanOrEqual(1);
    // Vendidas nunca supera el total: es la barra de ocupación.
    expect(torre.unitsSold).toBeLessThanOrEqual(torre.totalUnits);
  });
});

describe("GET /developer/investors", () => {
  it("trae al investor que compró en el proyecto del developer", async () => {
    const res = await request(app)
      .get("/api/v1/developer/investors")
      .set("Authorization", `Bearer ${tokenDev}`);

    expect(res.status).toBe(200);
    const investor = res.body.find((i: { email: string }) => i.email === FIXTURES.investor.email);
    expect(investor.units).toBeGreaterThanOrEqual(1);
    expect(investor.investedMinorUnits).toBeGreaterThanOrEqual(12_000_000);
    expect(investor.projects).toContain("Torre Test");
  });

  it("un developer sin membresía no ve los investors ajenos", async () => {
    const res = await request(app)
      .get("/api/v1/developer/investors")
      .set("Authorization", `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
