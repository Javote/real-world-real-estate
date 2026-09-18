import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { dossierRateLimiter, dossierRateLimitMax } from "../src/middlewares/rateLimit";

// SPEC-211 (B-11) — `GET /public/dossier/:shareToken` es la otra ruta sin
// sesión del backlog (junto a `/auth/login`) y no tenía ningún límite: cada
// hit corre `compileDossier` (varias queries, una escritura si el hash
// cambió, y una consulta a Blockfrost si el dossier está firmado) desde
// tráfico sin sesión. Mismo patrón de test que `rate-limit.test.ts` para el
// login: el limiter se prueba montado en una app mínima con un max propio,
// para no chocar con los demás archivos que comparten proceso e IP.

const appDePrueba = (
  max: number,
  handler: (req: express.Request, res: express.Response) => void
) => {
  const a = express();
  a.get("/dossier/:token", dossierRateLimiter(max, 60_000), handler);
  return a;
};

describe("dossierRateLimiter", () => {
  it("deja pasar hasta el límite y corta con 429", async () => {
    const handler = vi.fn((_req, res) => res.json({ ok: true }));
    const a = appDePrueba(3, handler);

    for (let i = 0; i < 3; i++) {
      expect((await request(a).get("/dossier/x")).status).toBe(200);
    }

    const cortado = await request(a).get("/dossier/x");
    expect(cortado.status).toBe(429);
    // El handler (y por lo tanto compileDossier) no corre para el pedido que
    // excede el límite: el 429 se contesta ANTES de tocar la base.
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("un token inexistente repetido cuenta igual para el límite — si no, sería un oráculo por costo", async () => {
    // El handler simula "token no existe" (404), y aun así el 3er pedido corta.
    const handler = vi.fn((_req, res) => res.status(404).json({ message: "Dossier not found" }));
    const a = appDePrueba(2, handler);

    expect((await request(a).get("/dossier/no-existe")).status).toBe(404);
    expect((await request(a).get("/dossier/no-existe")).status).toBe(404);
    expect((await request(a).get("/dossier/no-existe")).status).toBe(429);
  });

  it("el 429 tiene el mismo shape de error que el resto de la API", async () => {
    const a = appDePrueba(1, (_req, res) => res.json({ ok: true }));
    await request(a).get("/dossier/x");

    const res = await request(a).get("/dossier/x");
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty("message");
  });
});

describe("dossierRateLimitMax", () => {
  it("sin la variable usa el default (más laxo que el login)", () => {
    expect(dossierRateLimitMax({})).toBe(60);
  });

  it("un valor inválido o absurdo cae al default, no a 'sin límite'", () => {
    expect(dossierRateLimitMax({ DOSSIER_RATE_LIMIT_MAX: "0" })).toBe(60);
    expect(dossierRateLimitMax({ DOSSIER_RATE_LIMIT_MAX: "-5" })).toBe(60);
    expect(dossierRateLimitMax({ DOSSIER_RATE_LIMIT_MAX: "muchos" })).toBe(60);
  });
});

describe("cableado sobre la app real", () => {
  it("GET /public/dossier/:shareToken responde con las cabeceras del limiter", async () => {
    // Un escribano abriendo el link una vez (o cinco, muy por debajo del
    // default de 60) pasa sin problema — lo que se prueba acá es que el
    // limiter está EN la cadena, no que corte.
    const res = await request(app).get(`/api/v1/public/dossier/${"a".repeat(64)}`);

    expect(res.status).toBe(404);
    expect(res.headers).toHaveProperty("ratelimit");
  });

  it("una ruta con sesión no lleva este limiter", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.headers).not.toHaveProperty("ratelimit");
  });
});
