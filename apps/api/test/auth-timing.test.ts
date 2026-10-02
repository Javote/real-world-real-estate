import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { en } from "../src/lib/arrays.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";

afterAll(async () => {
  await db.destroy();
});

const login = (email: string, password: string) =>
  request(app).post("/api/v1/auth/login").send({ email, password });

async function medir(fn: () => Promise<unknown>) {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

const mediana = (xs: number[]) =>
  en(
    [...xs].sort((a, b) => a - b),
    Math.floor(xs.length / 2)
  );

describe("POST /api/v1/auth/login · el tiempo no filtra si el email existe", () => {
  it("un email inexistente cuesta lo mismo que una password incorrecta", async () => {
    const inexistentes: number[] = [];
    const passwordsMalas: number[] = [];

    await login(FIXTURES.activo.email, "calentando");

    for (let i = 0; i < 5; i++) {
      inexistentes.push(await medir(() => login("no-existe@test.local", "loquesea")));
      passwordsMalas.push(await medir(() => login(FIXTURES.activo.email, "password-equivocada")));
    }

    const sinUsuario = mediana(inexistentes);
    const conUsuario = mediana(passwordsMalas);

    expect(sinUsuario).toBeGreaterThan(conUsuario * 0.5);
    expect(sinUsuario).toBeLessThan(conUsuario * 2);
  });

  it("un usuario inactivo tampoco se distingue por tiempo", async () => {
    await login(FIXTURES.activo.email, "calentando");

    const inactivos: number[] = [];
    const passwordsMalas: number[] = [];

    for (let i = 0; i < 3; i++) {
      inactivos.push(await medir(() => login(FIXTURES.inactivo.email, FIXTURES.inactivo.password)));
      passwordsMalas.push(await medir(() => login(FIXTURES.activo.email, "password-equivocada")));
    }

    expect(mediana(inactivos)).toBeGreaterThan(mediana(passwordsMalas) * 0.5);
  });

  it("el hash dummy no valida contra ninguna password", async () => {
    for (const password of ["", "password", "dev123", "$2b$10$loqueseaquesuenaahash"]) {
      const res = await login("no-existe@test.local", password);

      expect(res.status).not.toBe(200);
      expect(res.body).not.toHaveProperty("token");
    }
  });
});
