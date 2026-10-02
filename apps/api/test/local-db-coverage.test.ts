import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { asegurarDirectorioLocal } from "../src/db/local-db";

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

    expect(existsSync(dir)).toBe(antes);
  });
});
