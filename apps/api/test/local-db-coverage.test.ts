import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { asegurarDirectorioLocal } from "../src/db/local-db";

// SPEC-018 §A6 — `asegurarDirectorioLocal` con una URL que NO es `file:`
// (Turso). `migrate-cli.test.ts` solo la ejercita con URLs `file:` (la única
// rama que le importa a esas suites); esta cubre el early-return: contra una
// URL remota no crea ningún directorio, ni falla intentándolo.

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("asegurarDirectorioLocal", () => {
  it("con una URL libsql:// (remota), no crea nada — es un no-op", () => {
    dir = mkdtempSync(path.join(tmpdir(), "spec-018-local-db-"));
    const antes = existsSync(dir);

    expect(() => asegurarDirectorioLocal("libsql://ejemplo.turso.io")).not.toThrow();

    // El directorio de prueba sigue exactamente como estaba: la función ni
    // lo tocó, ni tocó ningún otro lado del filesystem por esta URL.
    expect(existsSync(dir)).toBe(antes);
  });
});
