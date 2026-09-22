import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrar } from "../src/db/migrate";

// `applyPendingMigrations`/`conTecho` ya tienen su propia suite
// (`migrate-atomico.test.ts`, `migrate-techo.test.ts`). Lo que `migrar()`
// agrega encima —resolver la URL, crear el directorio si falta, conectar,
// cerrar el cliente, los mensajes de log— es justo lo que corre
// `pnpm db:migrate` y el `startCommand` de Render, y no tenía ningún test:
// `main()` estaba detrás del guardia `require.main === module`.

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("migrar", () => {
  it("crea el directorio que falta, aplica las migraciones reales y devuelve sus nombres", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "spec-017-migrate-"));
    // El subdirectorio "nested" no existe todavía — es lo que prueba
    // `asegurarDirectorioLocal`, que SQLite no crea solo.
    const url = `file:${path.join(dir, "nested", "migrate-test.db")}`;

    const aplicadas = await migrar(url);

    expect(aplicadas.length).toBeGreaterThan(0);
    expect(aplicadas.every((f) => f.endsWith(".sql"))).toBe(true);
    expect(existsSync(path.join(dir, "nested"))).toBe(true);
  });

  it("es idempotente — correrla dos veces no vuelve a aplicar nada la segunda", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "spec-017-migrate-"));
    const url = `file:${path.join(dir, "migrate-test.db")}`;

    const primera = await migrar(url);
    expect(primera.length).toBeGreaterThan(0);

    const segunda = await migrar(url);
    expect(segunda).toEqual([]);
  });
});
