import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app";
import { loginRateLimiter, loginRateLimitMax, trustProxyHops } from "../src/middlewares/rateLimit";
import { FIXTURES } from "./global-setup";

const appDePrueba = (max: number) => {
  const a = express();
  a.use(express.json());
  a.post("/login", loginRateLimiter(max, 60_000), (_req, res) => res.json({ ok: true }));
  return a;
};

describe("límite de intentos de login", () => {
  it("deja pasar hasta el límite y corta con 429", async () => {
    const a = appDePrueba(3);

    for (let i = 0; i < 3; i++) {
      expect((await request(a).post("/login").send({})).status).toBe(200);
    }

    const cortado = await request(a).post("/login").send({});
    expect(cortado.status).toBe(429);
  });

  it("cuenta los intentos exitosos también", async () => {
    const a = appDePrueba(2);

    expect((await request(a).post("/login").send({})).status).toBe(200);
    expect((await request(a).post("/login").send({})).status).toBe(200);
    expect((await request(a).post("/login").send({})).status).toBe(429);
  });

  it("el 429 tiene el mismo shape de error que el resto de la API", async () => {
    const a = appDePrueba(1);
    await request(a).post("/login").send({});

    const res = await request(a).post("/login").send({});
    expect(res.body).toHaveProperty("message");
  });
});

describe("trustProxyHops", () => {
  it("sin la variable no confía en ningún proxy", () => {
    expect(trustProxyHops({})).toBe(0);
  });

  it("lee la cantidad de saltos", () => {
    expect(trustProxyHops({ TRUST_PROXY_HOPS: "1" })).toBe(1);
  });

  it("`true` no es una configuración alcanzable", () => {
    expect(trustProxyHops({ TRUST_PROXY_HOPS: "true" })).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: "-1" })).toBe(0);
    expect(trustProxyHops({ TRUST_PROXY_HOPS: "cualquier cosa" })).toBe(0);
  });
});

describe("loginRateLimitMax", () => {
  it("sin la variable usa el default", () => {
    expect(loginRateLimitMax({})).toBe(20);
  });

  it("un valor inválido o absurdo cae al default, no a 'sin límite'", () => {
    expect(loginRateLimitMax({ LOGIN_RATE_LIMIT_MAX: "0" })).toBe(20);
    expect(loginRateLimitMax({ LOGIN_RATE_LIMIT_MAX: "-5" })).toBe(20);
    expect(loginRateLimitMax({ LOGIN_RATE_LIMIT_MAX: "muchos" })).toBe(20);
  });
});

describe("cableado sobre la app real", () => {
  it("POST /auth/login responde con las cabeceras del limiter", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: FIXTURES.activo.email, password: FIXTURES.activo.password });

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty("ratelimit");
  });

  it("otros endpoints no llevan el limiter", async () => {
    const res = await request(app).get("/api/v1/auth/me");

    expect(res.headers).not.toHaveProperty("ratelimit");
  });
});
