import { describe, expect, it } from "vitest";
import { esBaseLocal, exigirBaseLocal, passwordDeProduccion } from "../src/db/credentials.js";

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

describe("exigirBaseLocal — el seed local no toca una base desplegada", () => {
  it("deja pasar un SQLite en disco", () => {
    expect(() => exigirBaseLocal({ DATABASE_URL: "file:./.data/dev.db" })).not.toThrow();
  });

  it("sin DATABASE_URL deja pasar: la conexión cae a la base local, y el chequeo también", () => {
    expect(() => exigirBaseLocal({})).not.toThrow();
  });

  it("revienta contra una base remota, aunque estén las passwords de producción", () => {
    expect(() =>
      exigirBaseLocal({
        DATABASE_URL: "libsql://propnexus.turso.io",
        SEED_ADMIN_PASSWORD: "una password larga y valida"
      })
    ).toThrow(/db:seed:produccion/);
  });

  it("una DATABASE_URL vacía NO cuenta como local: la conexión tampoco caería al default", () => {
    expect(() => exigirBaseLocal({ DATABASE_URL: "" })).toThrow();
  });
});

describe("passwordDeProduccion — sin defaults", () => {
  it("usa la del entorno", () => {
    const pw = "una password larga y valida";
    expect(passwordDeProduccion("SEED_ADMIN_PASSWORD", { SEED_ADMIN_PASSWORD: pw })).toBe(pw);
  });

  it("sin la variable revienta, también contra una base local", () => {
    expect(() =>
      passwordDeProduccion("SEED_ADMIN_PASSWORD", { DATABASE_URL: "file:./.data/dev.db" })
    ).toThrow(/SEED_ADMIN_PASSWORD/);
  });

  it("una variable vacía o de espacios cuenta como ausente", () => {
    expect(() => passwordDeProduccion("SEED_DEMO_PASSWORD", { SEED_DEMO_PASSWORD: "  " })).toThrow(
      /SEED_DEMO_PASSWORD/
    );
  });

  it("una que no cumple la política revienta", () => {
    expect(() =>
      passwordDeProduccion("SEED_ADMIN_PASSWORD", { SEED_ADMIN_PASSWORD: "corta12" })
    ).toThrow(/política/);
  });
});
