import { PASSWORD_MAX_BYTES, PASSWORD_MIN_CHARS } from "@plataforma/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";

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

describe("POST /api/v1/users aplica la política de passwords", () => {
  it(`rechaza con menos de ${PASSWORD_MIN_CHARS} caracteres`, async () => {
    const res = await crearUsuario("corta12", "corta@test.local");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(res.body.data.issues.some((i: { path: string[] }) => i.path.includes("password"))).toBe(
      true
    );
  });

  it(`rechaza por encima de ${PASSWORD_MAX_BYTES} bytes en vez de truncar`, async () => {
    const res = await crearUsuario("a".repeat(PASSWORD_MAX_BYTES + 1), "larga@test.local");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BAD_REQUEST");
    expect(res.body.data.issues.some((i: { path: string[] }) => i.path.includes("password"))).toBe(
      true
    );
  });

  it("acepta una password que cumple, y el usuario puede loguearse", async () => {
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

describe("PATCH /api/v1/users/:id con password válida", () => {
  it("hashea la password nueva y permite loguearse con ella", async () => {
    const email = "cambia-password@test.local";
    const nuevaPassword = "una password larga y valida para cambiar";

    const creado = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email, password: "una password original valida", role: "buyer", fullName: "Cambia" });
    expect(creado.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/users/${creado.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: nuevaPassword });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(creado.body.id);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: nuevaPassword });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });
});
