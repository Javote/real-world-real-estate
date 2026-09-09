import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { FIXTURES } from "./global-setup";

// Path params con Zod (`router.param`, `packages/shared/src/params.ts`) — la
// pieza que faltaba de la regla 6. Un caso por FORMA, no por ruta: si el
// `cuidParamSchema` rechaza mal un id en una ruta, lo hace en las 50 que lo
// usan, así que alcanza con probarlo una vez por forma contra una ruta real de
// cada tipo.

let token: string;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password });
  token = res.body.token;
});

describe("path params inválidos — 400 antes de tocar la base", () => {
  it("un :id que no tiene forma de cuid2 es 400, no un 404 ambiguo", async () => {
    const res = await request(app)
      .get("/api/v1/stages/no-es-un-cuid")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toBeDefined();
  });

  it("un :id bien formado pero inexistente sigue dando 404 — no se confunden las dos cosas", async () => {
    // 24 minúsculas/dígitos arrancando con letra: la forma real, sin existir.
    const res = await request(app)
      .get("/api/v1/stages/aaaaaaaaaaaaaaaaaaaaaaaa")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("un :fileHash que no es hex64 es 400", async () => {
    const res = await request(app)
      .get("/api/v1/evidence/aaaaaaaaaaaaaaaaaaaaaaaa/proof/no-es-un-hash")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("un :stageNum que no es un entero positivo es 400", async () => {
    const res = await request(app)
      .post("/api/v1/developer/contracts/aaaaaaaaaaaaaaaaaaaaaaaa/releases/no-numero")
      .set("Authorization", `Bearer ${token}`)
      .send({ amountMinorUnits: 1000 });

    expect(res.status).toBe(400);
  });

  it("un :stageNum negativo o cero también es 400, no solo el no-numérico", async () => {
    const negativo = await request(app)
      .post("/api/v1/developer/contracts/aaaaaaaaaaaaaaaaaaaaaaaa/releases/-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ amountMinorUnits: 1000 });
    const cero = await request(app)
      .post("/api/v1/developer/contracts/aaaaaaaaaaaaaaaaaaaaaaaa/releases/0")
      .set("Authorization", `Bearer ${token}`)
      .send({ amountMinorUnits: 1000 });

    expect(negativo.status).toBe(400);
    expect(cero.status).toBe(400);
  });

  it("un :stageNum válido sigue funcionando (404 por contrato inexistente, no 400)", async () => {
    const res = await request(app)
      .post("/api/v1/developer/contracts/aaaaaaaaaaaaaaaaaaaaaaaa/releases/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ amountMinorUnits: 1000 });

    expect(res.status).toBe(404);
  });
});
