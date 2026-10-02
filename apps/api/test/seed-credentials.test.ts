import { describe, expect, it } from "vitest";
import { esBaseLocal, paraMostrar, passwordDeDemo } from "../src/db/credentials";

const LOCAL = { DATABASE_URL: "file:./dev.db" };
const REMOTA = { DATABASE_URL: "libsql://propnexus.turso.io" };

describe("esBaseLocal", () => {
  it("reconoce un SQLite en disco", () => {
    expect(esBaseLocal("file:./dev.db")).toBe(true);
    expect(esBaseLocal("  FILE:./test.db  ")).toBe(true);
  });

  it("no confunde una base remota con una local", () => {
    expect(esBaseLocal("libsql://propnexus.turso.io")).toBe(false);
    expect(esBaseLocal("postgres://user@host/db")).toBe(false);
    expect(esBaseLocal("")).toBe(false);
  });
});

describe("passwordDeDemo", () => {
  it("contra una base local usa el default documentado", () => {
    expect(passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", LOCAL)).toBe("admin123");
  });

  it("contra una base remota SIN la variable, revienta", () => {
    expect(() => passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", REMOTA)).toThrow(
      /SEED_ADMIN_PASSWORD/
    );
  });

  it("sin DATABASE_URL usa el default: la conexión cae a la base local, y el chequeo también", () => {
    expect(passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", {})).toBe("admin123");
  });

  it("una DATABASE_URL vacía NO cuenta como local: la conexión tampoco caería al default", () => {
    expect(() => passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", { DATABASE_URL: "" })).toThrow(
      /SEED_ADMIN_PASSWORD/
    );
  });

  it("contra una base remota CON la variable, la usa", () => {
    const pw = "una password larga y valida";
    expect(
      passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", { ...REMOTA, SEED_ADMIN_PASSWORD: pw })
    ).toBe(pw);
  });

  it("una variable que no cumple la política revienta, también en local", () => {
    expect(() =>
      passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", {
        ...LOCAL,
        SEED_ADMIN_PASSWORD: "corta12"
      })
    ).toThrow(/política/);
  });

  it("una variable vacía o de espacios cuenta como ausente", () => {
    expect(
      passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", { ...LOCAL, SEED_ADMIN_PASSWORD: "  " })
    ).toBe("admin123");
    expect(() =>
      passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", { ...REMOTA, SEED_ADMIN_PASSWORD: "" })
    ).toThrow();
  });
});

describe("paraMostrar", () => {
  it("imprime el default local, que ya es público", () => {
    expect(paraMostrar("SEED_ADMIN_PASSWORD", "admin123", LOCAL)).toBe("admin123");
  });

  it("NUNCA imprime una password que vino del entorno", () => {
    const salida = paraMostrar("SEED_ADMIN_PASSWORD", "admin123", {
      ...REMOTA,
      SEED_ADMIN_PASSWORD: "el-secreto-de-produccion"
    });

    expect(salida).not.toContain("el-secreto-de-produccion");
    expect(salida).toBe("(desde SEED_ADMIN_PASSWORD)");
  });
});
