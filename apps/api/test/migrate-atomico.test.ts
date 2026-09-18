import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyPendingMigrations } from "../src/db/migrate";
import { createClient } from "../src/lib/libsql-client";

// SPEC-203 (B-03) — antes, `applyPendingMigrations` corría los statements de
// un archivo uno por uno con un `for`: si el statement N fallaba, los N-1
// anteriores ya habían corrido y el archivo no quedaba marcado en
// `_migrations` — el próximo arranque lo reintentaba desde el principio y
// moría con "table already exists", para siempre, sin intervención manual
// (Render free tier no da shell). Ahora es un solo `client.batch(...,
// "write")`, transaccional: o entra el archivo entero, o no entra nada.

let dir: string | undefined;
let client: ReturnType<typeof createClient> | undefined;

afterEach(() => {
  client?.close();
  client = undefined;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function archivoTemporal(nombre: string, sql: string) {
  dir = mkdtempSync(path.join(tmpdir(), "spec-203-"));
  writeFileSync(path.join(dir, nombre), sql);
  return dir;
}

describe("applyPendingMigrations es atómica por archivo", () => {
  it("un statement inválido a mitad de archivo no deja NINGUNA tabla de ese archivo", async () => {
    const carpeta = archivoTemporal(
      "0001_rompe.sql",
      [
        "CREATE TABLE Uno (id text)",
        "CREATE TABLE Dos (id text)",
        "ESTO NO ES SQL VALIDO",
        "CREATE TABLE Tres (id text)"
      ].join("\n--> statement-breakpoint\n")
    );

    client = createClient({ url: ":memory:" });

    await expect(applyPendingMigrations(client, carpeta)).rejects.toThrow();

    const tablas = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Uno', 'Dos', 'Tres')"
    );
    expect(tablas.rows).toHaveLength(0);

    // Invariante 2: `_migrations` no miente. Si falló, el archivo no figura.
    const registro = await client.execute({
      sql: "SELECT name FROM _migrations WHERE name = ?",
      args: ["0001_rompe.sql"]
    });
    expect(registro.rows).toHaveLength(0);
  });

  it("reintentar después de esa falla aplica el archivo limpio desde cero", async () => {
    const carpeta = archivoTemporal(
      "0001_ok.sql",
      ["CREATE TABLE Uno (id text)", "CREATE TABLE Dos (id text)"].join(
        "\n--> statement-breakpoint\n"
      )
    );

    client = createClient({ url: ":memory:" });

    const aplicadas = await applyPendingMigrations(client, carpeta);
    expect(aplicadas).toEqual(["0001_ok.sql"]);

    const tablas = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Uno', 'Dos')"
    );
    expect(tablas.rows).toHaveLength(2);
  });

  it("un archivo ya aplicado se saltea, como antes", async () => {
    const carpeta = archivoTemporal("0001_ok.sql", "CREATE TABLE Uno (id text)");

    client = createClient({ url: ":memory:" });

    const primera = await applyPendingMigrations(client, carpeta);
    expect(primera).toEqual(["0001_ok.sql"]);

    const segunda = await applyPendingMigrations(client, carpeta);
    expect(segunda).toEqual([]);
  });
});
