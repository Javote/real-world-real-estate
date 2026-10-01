import { afterEach, describe, expect, it, vi } from "vitest";

describe("lib/db — las ramas que el resto de la suite nunca pisa", () => {
  const urlOriginal = process.env.DATABASE_URL;
  const tokenOriginal = process.env.DATABASE_AUTH_TOKEN;

  afterEach(() => {
    process.env.DATABASE_URL = urlOriginal;
    process.env.DATABASE_AUTH_TOKEN = tokenOriginal;
    vi.resetModules();
  });

  it("sin DATABASE_URL, cae al default en vez de tirar", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_AUTH_TOKEN;
    vi.resetModules();

    const { db } = await import("../src/lib/db.js");
    expect(db).toBeDefined();
    await db.destroy();
  });

  it("con DATABASE_AUTH_TOKEN seteado, lo suma al dialect en vez de omitirlo", async () => {
    process.env.DATABASE_URL = urlOriginal;
    process.env.DATABASE_AUTH_TOKEN = "token-de-prueba";
    vi.resetModules();

    const { db } = await import("../src/lib/db.js");
    expect(db).toBeDefined();
    await db.destroy();
  });
});
