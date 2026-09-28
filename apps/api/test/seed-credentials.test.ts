import { describe, expect, it } from "vitest";
import { esBaseLocal, paraMostrar, passwordDeDemo } from "../src/db/credentials";

const LOCAL = { DATABASE_URL: "file:./dev.db" };
const REMOTA = { DATABASE_URL: "libsql://propnexus.turso.io" };

// D-047. El seed publica sus credenciales, así que la pregunta no es cuán
// fuertes son sino DÓNDE se pueden sembrar.
describe("esBaseLocal", () => {
  it("reconoce un SQLite en disco", () => {
    expect(esBaseLocal("file:./dev.db")).toBe(true);
    expect(esBaseLocal("  FILE:./test.db  ")).toBe(true);
  });

  it("no confunde una base remota con una local", () => {
    expect(esBaseLocal("libsql://propnexus.turso.io")).toBe(false);
    expect(esBaseLocal("postgres://user@host/db")).toBe(false);
    // Sin DATABASE_URL tampoco: "no sé dónde estoy" no puede significar "local".
    expect(esBaseLocal("")).toBe(false);
  });
});

describe("passwordDeDemo", () => {
  it("contra una base local usa el default documentado", () => {
    // Es lo que hace que `pnpm db:seed` siga siendo un comando sin fricción.
    expect(passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", LOCAL)).toBe("admin123");
  });

  it("contra una base remota SIN la variable, revienta", () => {
    // El caso que motiva todo: sembrar admin123 en la URL pública del criterio 12.
    expect(() => passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", REMOTA)).toThrow(
      /SEED_ADMIN_PASSWORD/
    );
  });

  it("sin DATABASE_URL usa el default: la conexión cae a la base local, y el chequeo también", () => {
    // Antes esto reventaba con el argumento de "no sé contra qué base estoy".
    // Pero sí se sabe: `lib/db.ts` conecta a `DEFAULT_DATABASE_URL`, un SQLite
    // local. El chequeo y la conexión resuelven con `urlDeLaBase`, así que no
    // pueden volver a leer bases distintas.
    expect(passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123", {})).toBe("admin123");
  });

  it("una DATABASE_URL vacía NO cuenta como local: la conexión tampoco caería al default", () => {
    // `??` solo cae con undefined. Un `DATABASE_URL=` vacío sigue reventando,
    // del lado seguro, igual que antes.
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
    // Sin esto el seed sería el agujero de su propia política (D-046): crearía
    // un admin que `POST /users` jamás habría aceptado crear.
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
    // Los logs de la plataforma se guardan. Publicar ahí lo que se sacó del repo
    // deshace el arreglo entero.
    const salida = paraMostrar("SEED_ADMIN_PASSWORD", "admin123", {
      ...REMOTA,
      SEED_ADMIN_PASSWORD: "el-secreto-de-produccion"
    });

    expect(salida).not.toContain("el-secreto-de-produccion");
    expect(salida).toBe("(desde SEED_ADMIN_PASSWORD)");
  });
});
