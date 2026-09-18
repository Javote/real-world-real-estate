import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "../src/lib/libsql-client";
import { MIGRATIONS_DIR } from "../src/db/migrate";

// SPEC-202 (B-02) — prueba la migración 0006 en aislamiento, contra una base
// en memoria con SOLO la tabla `Dossier` (no hace falta el esquema entero: la
// migración solo toca esta tabla), sembrada con los duplicados que la
// auditoría reprodujo. El criterio de desempate está escrito en el propio
// archivo de migración; acá se verifica que el SQL lo aplica de verdad.

const SQL_MIGRACION = readFileSync(path.join(MIGRATIONS_DIR, "0006_dossier_unitid_unico.sql"), "utf-8");
const STATEMENTS = SQL_MIGRACION.split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

let client: ReturnType<typeof createClient> | undefined;

afterEach(() => {
  client?.close();
  client = undefined;
});

async function base() {
  const c = createClient({ url: ":memory:" });
  await c.execute(`
    CREATE TABLE Dossier (
      id text PRIMARY KEY NOT NULL,
      unitId text NOT NULL,
      masterHash text NOT NULL,
      compiledAt integer NOT NULL,
      shareToken text,
      status text DEFAULT 'compiled' NOT NULL,
      signedById text,
      signedAt integer,
      rejectionNote text
    )
  `);
  await c.execute("CREATE INDEX Dossier_unitId_idx ON Dossier (unitId)");
  client = c;
  return c;
}

async function correrMigracion(c: Awaited<ReturnType<typeof base>>) {
  for (const statement of STATEMENTS) {
    await c.execute(statement);
  }
}

async function insertar(
  c: Awaited<ReturnType<typeof base>>,
  fila: {
    id: string;
    unitId: string;
    compiledAt: number;
    shareToken?: string | null;
    signedById?: string | null;
  }
) {
  await c.execute({
    sql: `INSERT INTO Dossier (id, unitId, masterHash, compiledAt, shareToken, signedById)
          VALUES (?, ?, 'hash', ?, ?, ?)`,
    args: [fila.id, fila.unitId, fila.compiledAt, fila.shareToken ?? null, fila.signedById ?? null]
  });
}

describe("migración 0006 — un dossier por unidad", () => {
  it("sin duplicados, no borra nada y deja el índice único", async () => {
    const c = await base();
    await insertar(c, { id: "d1", unitId: "u1", compiledAt: 1 });
    await insertar(c, { id: "d2", unitId: "u2", compiledAt: 1 });

    await correrMigracion(c);

    const filas = await c.execute("SELECT id FROM Dossier ORDER BY id");
    expect(filas.rows.map((r) => r.id)).toEqual(["d1", "d2"]);

    // El índice único ahora existe: un segundo insert sobre u1 choca.
    await expect(
      c.execute({
        sql: "INSERT INTO Dossier (id, unitId, masterHash, compiledAt) VALUES (?, ?, 'x', 2)",
        args: ["d3", "u1"]
      })
    ).rejects.toThrow();
  });

  it("duplicado sin shareToken ni firma: sobrevive el de compiledAt más antiguo", async () => {
    const c = await base();
    await insertar(c, { id: "viejo", unitId: "u1", compiledAt: 100 });
    await insertar(c, { id: "nuevo", unitId: "u1", compiledAt: 200 });

    await correrMigracion(c);

    const filas = await c.execute("SELECT id FROM Dossier WHERE unitId = 'u1'");
    expect(filas.rows).toHaveLength(1);
    expect(filas.rows[0]?.id).toBe("viejo");
  });

  it("duplicado con un shareToken: sobrevive la fila compartida, aunque sea la más nueva", async () => {
    const c = await base();
    await insertar(c, { id: "sin-token", unitId: "u1", compiledAt: 100 });
    await insertar(c, { id: "compartida", unitId: "u1", compiledAt: 200, shareToken: "t".repeat(64) });

    await correrMigracion(c);

    const filas = await c.execute("SELECT id FROM Dossier WHERE unitId = 'u1'");
    expect(filas.rows).toHaveLength(1);
    expect(filas.rows[0]?.id).toBe("compartida");
  });

  it("duplicado con una firma: sobrevive la fila firmada, aunque sea la más nueva", async () => {
    const c = await base();
    await insertar(c, { id: "sin-firma", unitId: "u1", compiledAt: 100 });
    await insertar(c, { id: "firmada", unitId: "u1", compiledAt: 200, signedById: "notario-1" });

    await correrMigracion(c);

    const filas = await c.execute("SELECT id FROM Dossier WHERE unitId = 'u1'");
    expect(filas.rows).toHaveLength(1);
    expect(filas.rows[0]?.id).toBe("firmada");
  });

  it("resuelve varias unidades duplicadas a la vez, cada una con su propio criterio", async () => {
    const c = await base();
    await insertar(c, { id: "u1-viejo", unitId: "u1", compiledAt: 1 });
    await insertar(c, { id: "u1-nuevo", unitId: "u1", compiledAt: 2 });
    await insertar(c, { id: "u2-sola", unitId: "u2", compiledAt: 1 });
    await insertar(c, { id: "u3-token", unitId: "u3", compiledAt: 1, shareToken: "s".repeat(64) });
    await insertar(c, { id: "u3-sin-token", unitId: "u3", compiledAt: 2 });

    await correrMigracion(c);

    const filas = await c.execute("SELECT id, unitId FROM Dossier ORDER BY unitId");
    expect(filas.rows.map((r) => r.id)).toEqual(["u1-viejo", "u2-sola", "u3-token"]);
  });

  it("corrida dos veces (regla 8): la segunda no borra nada más y no falla el índice", async () => {
    const c = await base();
    await insertar(c, { id: "viejo", unitId: "u1", compiledAt: 1 });
    await insertar(c, { id: "nuevo", unitId: "u1", compiledAt: 2 });

    await correrMigracion(c);
    await correrMigracion(c);

    const filas = await c.execute("SELECT id FROM Dossier WHERE unitId = 'u1'");
    expect(filas.rows).toHaveLength(1);
    expect(filas.rows[0]?.id).toBe("viejo");
  });
});
