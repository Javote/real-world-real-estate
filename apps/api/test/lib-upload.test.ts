import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// `vitest.config.mts` fija UPLOAD_DIR para toda la suite (SPEC-017), así que
// el resto de los tests nunca ejercita el fallback de `lib/upload.ts` —
// `process.env.UPLOAD_DIR || path.resolve(__dirname, "..", "..", "uploads")`.
// Este test aísla ese caso: sin la variable, tiene que anclar al package y no
// al cwd (la trampa que el comentario del archivo documenta).
describe("uploadDir — sin UPLOAD_DIR, ancla al package", () => {
  const original = process.env.UPLOAD_DIR;

  afterEach(() => {
    process.env.UPLOAD_DIR = original;
    vi.resetModules();
  });

  it("crea el directorio default en vez de tirar", async () => {
    delete process.env.UPLOAD_DIR;
    vi.resetModules();

    await import("../src/lib/upload.js");

    const esperado = path.resolve(__dirname, "..", "uploads");
    expect(existsSync(esperado)).toBe(true);
  });
});
