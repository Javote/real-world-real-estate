import { describe, expect, it } from "vitest";
import {
  loginRequestSchema,
  loginResponseSchema,
  meResponseSchema,
  passwordSchema,
} from "./auth";

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

  it("acepta el rol notary (SPEC-011)", () => {
    const r = loginResponseSchema.safeParse({
      token: "t",
      user: { id: "u1", email: "notary@example.com", role: "notary", fullName: "Notary" },
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un rol que no existe", () => {
    const r = loginResponseSchema.safeParse({
      token: "t",
      user: { id: "u1", email: "dev@example.com", role: "superadmin", fullName: "Dev" },
    });
    expect(r.success).toBe(false);
  });

  // `extend()` sobre un strictObject conserva la estrictez. Está testeado y no
  // asumido: si un refactor la perdiera, /auth/me podría filtrar campos del
  // modelo en silencio y ningún otro test lo vería.
  it("FALLA si /auth/me trae un campo de más", () => {
    const base = {
      id: "u1",
      email: "d@e.com",
      role: "admin",
      fullName: "A",
      isActive: true,
      createdAt: "2026-08-20T12:00:00.000Z",
    };
    expect(meResponseSchema.safeParse(base).success).toBe(true);
    expect(meResponseSchema.safeParse({ ...base, passwordHash: "$2b$10$x" }).success).toBe(false);
  });

  it("exige que createdAt de /auth/me sea un ISO datetime", () => {
    const base = { id: "u1", email: "d@e.com", role: "admin", fullName: "A", isActive: true };
    expect(meResponseSchema.safeParse({ ...base, createdAt: "2026-08-20T12:00:00.000Z" }).success).toBe(true);
    expect(meResponseSchema.safeParse({ ...base, createdAt: "20/08/2026" }).success).toBe(false);
  });
});

// La política de D-046: NIST SP 800-63B §5.1.1.2 + OWASP Authentication Cheat
// Sheet. Cada fila de la tabla de esa decisión es un caso de acá.
describe("passwordSchema — la política de passwords", () => {
  const ok = (pw: string) => passwordSchema.safeParse(pw).success;

  it("rechaza por debajo del mínimo y acepta el mínimo justo", () => {
    expect(ok("1234567")).toBe(false);
    expect(ok("12345678")).toBe(true);
  });

  it("cuenta CARACTERES y no unidades UTF-16 para el mínimo", () => {
    // Cuatro emoji tienen `.length === 8` en JS. Si el mínimo usara `.min(8)`
    // de Zod, esto pasaría con la mitad de los caracteres que la política pide.
    expect("🔐🔐🔐🔐".length).toBe(8);
    expect(ok("🔐🔐🔐🔐")).toBe(false);
    expect(ok("🔐🔐🔐🔐🔐🔐🔐🔐")).toBe(true);
  });

  it("acepta 72 bytes y rechaza 73 — el límite de bcrypt", () => {
    // Más allá de 72 bytes bcrypt trunca EN SILENCIO. Rechazar es la única
    // salida honesta: NIST prohíbe truncar (D-046).
    expect(ok("a".repeat(72))).toBe(true);
    expect(ok("a".repeat(73))).toBe(false);
  });

  it("mide el máximo en BYTES, no en caracteres", () => {
    // 18 emoji = 18 code points pero 72 bytes UTF-8: justo en el límite.
    expect(ok("🔐".repeat(18))).toBe(true);
    expect(ok("🔐".repeat(19))).toBe(false);
  });

  it("no impone reglas de composición", () => {
    // NIST lo prohíbe explícitamente: empujan a `Password1!` y bajan la entropía
    // real. Si alguna vez esto falla, alguien agregó un regex que no debía.
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
    // A propósito (D-046): validar la política en el login lo convertiría en un
    // oráculo de cuál es, y dejaría afuera cuentas creadas bajo una anterior.
    expect(passwordSchema.safeParse("corta").success).toBe(false);
    expect(
      loginRequestSchema.safeParse({ email: "dev@example.com", password: "corta" }).success,
    ).toBe(true);
  });

  it("pero exige que venga algo", () => {
    expect(loginRequestSchema.safeParse({ email: "dev@example.com", password: "" }).success).toBe(
      false,
    );
  });
});
