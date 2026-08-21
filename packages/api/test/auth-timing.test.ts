import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

afterAll(async () => {
  await db.$client.close();
});

const login = (email: string, password: string) =>
  request(app).post("/api/v1/auth/login").send({ email, password });

async function medir(fn: () => Promise<unknown>) {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// specs/SPEC-010 §Casos borde · routes/auth.routes.ts.
describe("POST /api/v1/auth/login · el tiempo no filtra si el email existe", () => {
  it("un email inexistente cuesta lo mismo que una password incorrecta", async () => {
    // El caso viejo era categórico, no marginal: el camino "no existe" cortaba
    // antes de bcrypt y volvía en ~0 ms contra ~81 ms del otro. Por eso la
    // aserción es por orden de magnitud y no por milisegundos: fija la propiedad
    // que importa (se paga el hash igual) sin volverse flaky en CI compartido.
    const inexistentes: number[] = [];
    const passwordsMalas: number[] = [];

    // Warm-up: la primera request paga conexión de Prisma y JIT.
    await login(FIXTURES.activo.email, "calentando");

    // Intercaladas a propósito: si la máquina se frena a mitad de la corrida,
    // frena las dos series por igual en vez de castigar a la que iba después.
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
    // isActive=false es el tercer rechazo: antes también cortaba antes de bcrypt,
    // así que revelaba "esta cuenta existe pero está dada de baja".
    await login(FIXTURES.activo.email, "calentando");

    const inactivo = mediana(
      await Promise.all(
        [0, 0, 0].map(() => medir(() => login(FIXTURES.inactivo.email, FIXTURES.inactivo.password))),
      ),
    );
    const passwordMala = mediana(
      await Promise.all(
        [0, 0, 0].map(() => medir(() => login(FIXTURES.activo.email, "password-equivocada"))),
      ),
    );

    expect(inactivo).toBeGreaterThan(passwordMala * 0.5);
  });

  it("el hash dummy no valida contra ninguna password", async () => {
    // Si el hash de relleno fuera adivinable —un literal en el repo, o derivado
    // de algo fijo— una password elegida a mano abriría sesión de un usuario que
    // no existe. Se deriva de un UUID aleatorio por proceso justamente por esto.
    for (const password of ["", "password", "dev123", "$2b$10$loqueseaquesuenaahash"]) {
      const res = await login("no-existe@test.local", password);

      expect(res.status).not.toBe(200);
      expect(res.body).not.toHaveProperty("token");
    }
  });
});
