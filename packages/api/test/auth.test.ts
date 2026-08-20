import { loginResponseSchema, meResponseSchema } from "@plataforma/shared";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FIXTURES } from "./global-setup";

const login = (email: string, password: string) =>
  request(app).post("/api/v1/auth/login").send({ email, password });

afterAll(async () => {
  await prisma.$disconnect();
});

// Los casos borde salen de specs/SPEC-008 §Casos borde. Si un caso no está en
// la spec, el test no existe — y al revés: cada fila de esa tabla es un test.
describe("POST /api/v1/auth/login", () => {
  it("AUTH-LOGIN-001 · credenciales válidas devuelven token y usuario", async () => {
    const res = await login(FIXTURES.activo.email, FIXTURES.activo.password);

    expect(res.status).toBe(200);
    // El contrato compartido es la aserción: si la API cambia la forma de la
    // respuesta sin actualizar el schema, este test falla (regla 6).
    expect(loginResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.user.email).toBe(FIXTURES.activo.email);
  });

  it("nunca devuelve passwordHash", async () => {
    const res = await login(FIXTURES.activo.email, FIXTURES.activo.password);

    expect(res.status).toBe(200);
    expect(res.body.user).not.toHaveProperty("passwordHash");
    // Y no solo en `user`: en ninguna parte del cuerpo (regla 4 de CLAUDE.md).
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(JSON.stringify(res.body)).not.toContain("$2b$");
  });

  it("password incorrecta devuelve 401", async () => {
    const res = await login(FIXTURES.activo.email, "password-equivocada");

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty("token");
  });

  it("email inexistente devuelve EXACTAMENTE lo mismo que password incorrecta", async () => {
    const inexistente = await login("no-existe@test.local", "loquesea");
    const passwordMala = await login(FIXTURES.activo.email, "password-equivocada");

    // Si las dos respuestas difirieran, la API sería un oráculo de qué emails
    // están registrados: enumeración de usuarios gratis para cualquiera.
    expect(inexistente.status).toBe(passwordMala.status);
    expect(inexistente.body).toEqual(passwordMala.body);
  });

  it("body vacío devuelve 400 con el detalle de Zod", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({});

    expect(res.status).toBe(400);
    // `error.flatten()` (regla 6): fieldErrors por campo, no un mensaje suelto.
    expect(res.body).toHaveProperty("fieldErrors");
    expect(res.body.fieldErrors).toHaveProperty("email");
    expect(res.body.fieldErrors).toHaveProperty("password");
  });

  it("email malformado devuelve 400, no 401", async () => {
    const res = await login("no-soy-un-email", "dev123");

    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toHaveProperty("email");
  });

  it("un usuario con isActive=false no puede loguearse", async () => {
    const res = await login(FIXTURES.inactivo.email, FIXTURES.inactivo.password);

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty("token");
  });
});

describe("GET /api/v1/auth/me", () => {
  it("sin token devuelve 401", async () => {
    const res = await request(app).get("/api/v1/auth/me");

    expect(res.status).toBe(401);
  });

  it("con un token inválido devuelve 401", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer esto-no-es-un-token");

    expect(res.status).toBe(401);
  });

  it("AUTH-ME-001 · con token válido devuelve el usuario, sin passwordHash", async () => {
    const { body } = await login(FIXTURES.activo.email, FIXTURES.activo.password);
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(meResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("un token emitido antes de desactivar al usuario deja de servir", async () => {
    const { body } = await login(FIXTURES.revocable.email, FIXTURES.revocable.password);
    expect(body.token).toBeTruthy();

    await prisma.user.update({
      where: { email: FIXTURES.revocable.email },
      data: { isActive: false },
    });

    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${body.token}`);

    // El JWT sigue siendo criptográficamente válido: lo que lo invalida es la
    // revalidación de isActive en cada request (D-016). Sin ella, desactivar a
    // alguien no tendría efecto hasta que expire el token, 7 días después.
    expect(res.status).toBe(401);
  });
});
