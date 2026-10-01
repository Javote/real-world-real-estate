import { describe, expect, it } from "vitest";
import { loginRequestSchema, loginResponseSchema, meResponseSchema, passwordSchema } from "./auth";

describe("contrato de auth", () => {
  it("rechaza un email que no es email", () => {
    const r = loginRequestSchema.safeParse({ email: "no-soy-un-email", password: "secreto" });
    expect(r.success).toBe(false);
  });

  it("acepta credenciales bien formadas", () => {
    const r = loginRequestSchema.safeParse({ email: "dev@example.com", password: "dev123" });
    expect(r.success).toBe(true);
  });

  it("FALLA si la respuesta trae passwordHash", () => {
    const r = loginResponseSchema.safeParse({
      token: "t",
      user: {
        id: "u1",
        email: "dev@example.com",
        role: "developer",
        fullName: "Dev",
        passwordHash: "$2b$10$loquesea"
      }
    });
    expect(r.success).toBe(false);
  });

  it("acepta una respuesta de login bien formada", () => {
    const r = loginResponseSchema.safeParse({
      token: "t",
      user: { id: "u1", email: "dev@example.com", role: "developer", fullName: "Dev" }
    });
    expect(r.success).toBe(true);
  });

  it("acepta el rol notary (SPEC-011)", () => {
    const r = loginResponseSchema.safeParse({
      token: "t",
      user: { id: "u1", email: "notary@example.com", role: "notary", fullName: "Notary" }
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un rol que no existe", () => {
    const r = loginResponseSchema.safeParse({
      token: "t",
      user: { id: "u1", email: "dev@example.com", role: "superadmin", fullName: "Dev" }
    });
    expect(r.success).toBe(false);
  });

  it("FALLA si /auth/me trae un campo de más", () => {
    const base = {
      id: "u1",
      email: "d@e.com",
      role: "admin",
      fullName: "A",
      isActive: true,
      createdAt: "2026-08-20T12:00:00.000Z"
    };
    expect(meResponseSchema.safeParse(base).success).toBe(true);
    expect(meResponseSchema.safeParse({ ...base, passwordHash: "$2b$10$x" }).success).toBe(false);
  });

  it("exige que createdAt de /auth/me sea un ISO datetime", () => {
    const base = { id: "u1", email: "d@e.com", role: "admin", fullName: "A", isActive: true };
    expect(
      meResponseSchema.safeParse({ ...base, createdAt: "2026-08-20T12:00:00.000Z" }).success
    ).toBe(true);
    expect(meResponseSchema.safeParse({ ...base, createdAt: "20/08/2026" }).success).toBe(false);
  });
});

describe("passwordSchema — la política de passwords", () => {
  const ok = (pw: string) => passwordSchema.safeParse(pw).success;

  it("rechaza por debajo del mínimo y acepta el mínimo justo", () => {
    expect(ok("1234567")).toBe(false);
    expect(ok("12345678")).toBe(true);
  });

  it("cuenta CARACTERES y no unidades UTF-16 para el mínimo", () => {
    expect("🔐🔐🔐🔐".length).toBe(8);
    expect(ok("🔐🔐🔐🔐")).toBe(false);
    expect(ok("🔐🔐🔐🔐🔐🔐🔐🔐")).toBe(true);
  });

  it("acepta 72 bytes y rechaza 73 — el límite de bcrypt", () => {
    expect(ok("a".repeat(72))).toBe(true);
    expect(ok("a".repeat(73))).toBe(false);
  });

  it("mide el máximo en BYTES, no en caracteres", () => {
    expect(ok("🔐".repeat(18))).toBe(true);
    expect(ok("🔐".repeat(19))).toBe(false);
  });

  it("cuenta bien los de 2 y 3 bytes, no solo el ASCII y el emoji", () => {
    expect(ok("ñ".repeat(36))).toBe(true);
    expect(ok("ñ".repeat(37))).toBe(false);
    expect(ok("€".repeat(24))).toBe(true);
    expect(ok("€".repeat(25))).toBe(false);
  });

  it("no impone reglas de composición", () => {
    expect(ok("aaaaaaaa")).toBe(true);
    expect(ok("12345678")).toBe(true);
  });

  it("acepta espacios y Unicode", () => {
    expect(ok("una frase con espacios")).toBe(true);
    expect(ok("mañana ñandú")).toBe(true);
  });
});

describe("el login NO aplica la política", () => {
  it("acepta una password que la política rechazaría", () => {
    expect(passwordSchema.safeParse("corta").success).toBe(false);
    expect(
      loginRequestSchema.safeParse({ email: "dev@example.com", password: "corta" }).success
    ).toBe(true);
  });

  it("pero exige que venga algo", () => {
    expect(loginRequestSchema.safeParse({ email: "dev@example.com", password: "" }).success).toBe(
      false
    );
  });
});
