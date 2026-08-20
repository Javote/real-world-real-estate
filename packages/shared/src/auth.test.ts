import { describe, expect, it } from "vitest";
import { loginRequestSchema, loginResponseSchema, meResponseSchema } from "./auth";

describe("contrato de auth", () => {
  it("rechaza un email que no es email", () => {
    const r = loginRequestSchema.safeParse({ email: "no-soy-un-email", password: "secreto" });
    expect(r.success).toBe(false);
  });

  it("acepta credenciales bien formadas", () => {
    const r = loginRequestSchema.safeParse({ email: "dev@example.com", password: "dev123" });
    expect(r.success).toBe(true);
  });

  // El caso que justifica `.strict()`: sin él Zod descartaría passwordHash en
  // silencio y el schema "pasaría" con el secreto adentro. La defensa de la
  // regla 4 es el schema, no la disciplina de quien escribe la ruta.
  it("FALLA si la respuesta trae passwordHash", () => {
    const r = loginResponseSchema.safeParse({
      token: "t",
      user: {
        id: "u1",
        email: "dev@example.com",
        role: "developer",
        fullName: "Dev",
        passwordHash: "$2b$10$loquesea",
      },
    });
    expect(r.success).toBe(false);
  });

  it("acepta una respuesta de login bien formada", () => {
    const r = loginResponseSchema.safeParse({
      token: "t",
      user: { id: "u1", email: "dev@example.com", role: "developer", fullName: "Dev" },
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un rol que no existe", () => {
    const r = loginResponseSchema.safeParse({
      token: "t",
      user: { id: "u1", email: "dev@example.com", role: "notary", fullName: "Dev" },
    });
    expect(r.success).toBe(false);
  });

  it("exige que createdAt de /auth/me sea un ISO datetime", () => {
    const base = { id: "u1", email: "d@e.com", role: "admin", fullName: "A", isActive: true };
    expect(meResponseSchema.safeParse({ ...base, createdAt: "2026-08-20T12:00:00.000Z" }).success).toBe(true);
    expect(meResponseSchema.safeParse({ ...base, createdAt: "20/08/2026" }).success).toBe(false);
  });
});
