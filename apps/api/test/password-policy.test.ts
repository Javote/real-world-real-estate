import { PASSWORD_MAX_BYTES, PASSWORD_MIN_CHARS } from "@plataforma/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

let adminToken: string;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: FIXTURES.admin.email, password: FIXTURES.admin.password });
  adminToken = res.body.token;
});

afterAll(async () => {
  await db.destroy();
});

const crearUsuario = (password: string, email: string) =>
  request(app)
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email, password, role: "buyer", fullName: "Test" });

// La política vive en packages/shared (regla 6) y se prueba ahí caso por caso.
// Acá se prueba que los endpoints que ESCRIBEN passwords la apliquen — que es lo
// que antes no hacían: cada uno declaraba su propio min(6) inline.
describe("POST /api/v1/users aplica la política de passwords", () => {
  it(`rechaza con menos de ${PASSWORD_MIN_CHARS} caracteres`, async () => {
    const res = await crearUsuario("corta12", "corta@test.local");

    expect(res.status).toBe(400);
    // SPEC-216 §E4 — migrado a oRPC: el sobre de error ya no es
    // `error.flatten()`, es `ORPCError.toJSON()` (mismo cambio de forma que
    // ya aceptaron las 45 rutas de SPEC-212 y `auth.test.ts` en §E2). El
    // detalle de Zod sigue viajando, en `data.issues`.
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(res.body.data.issues.some((i: { path: string[] }) => i.path.includes("password"))).toBe(
      true
    );
  });

  it(`rechaza por encima de ${PASSWORD_MAX_BYTES} bytes en vez de truncar`, async () => {
    // El caso que importa: sin esto bcrypt hashea los primeros 72 bytes y
    // descarta el resto sin decir nada (D-046).
    const res = await crearUsuario("a".repeat(PASSWORD_MAX_BYTES + 1), "larga@test.local");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(res.body.data.issues.some((i: { path: string[] }) => i.path.includes("password"))).toBe(
      true
    );
  });

  it("acepta una password que cumple, y el usuario puede loguearse", async () => {
    // El control: prueba que la política no rompió el camino feliz. Y que se
    // pueda LOGUEAR después prueba que lo que se guardó es un hash usable.
    const email = "nuevo@test.local";
    const password = "una password larga y valida";

    expect((await crearUsuario(password, email)).status).toBe(201);

    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });
});

describe("PATCH /api/v1/users/:id aplica la misma política", () => {
  it("rechaza cambiar a una password que no cumple", async () => {
    // Es el endpoint que se olvida: se endurece el alta y el cambio queda
    // permitiendo lo que el alta prohíbe.
    const user = await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", FIXTURES.ajeno.email)
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .patch(`/api/v1/users/${user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: "corta12" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(res.body.data.issues.some((i: { path: string[] }) => i.path.includes("password"))).toBe(
      true
    );
  });
});
