import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

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
