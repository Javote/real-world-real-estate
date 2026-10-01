import type { Express } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

let dbActual: { destroy: () => Promise<unknown> } | undefined;

async function appFresca(): Promise<Express> {
  vi.resetModules();
  const { db } = await import("../src/lib/db.js");
  const appModule = await import("../src/app.js");
  dbActual = db;
  return appModule.default as unknown as Express;
}

afterEach(async () => {
  vi.doUnmock("../src/lib/kysely");
  if (dbActual) {
    await dbActual.destroy();
    dbActual = undefined;
  }
});

describe("GET /health", { timeout: 20_000 }, () => {
  it("200 cuando la base responde", async () => {
    const app = await appFresca();

    const respuesta = await request(app).get("/health");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ ok: true });
  });

  it("503 cuando la base no responde — el catch", async () => {
    vi.doMock("../src/lib/kysely", async (importOriginal) => {
      const real = await importOriginal<typeof import("../src/lib/kysely")>();
      return {
        ...real,
        sql: () => ({ execute: () => Promise.reject(new Error("la base se cayó")) })
      };
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const app = await appFresca();

      const respuesta = await request(app).get("/health");

      expect(respuesta.status).toBe(503);
      expect(respuesta.body).toEqual({ ok: false, message: "Database unavailable" });
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("una ruta que no existe", { timeout: 20_000 }, () => {
  it("404 en JSON, no la página HTML default de Express", async () => {
    const app = await appFresca();

    const respuesta = await request(app).get("/api/v1/no-existe-esta-ruta");

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ message: "Not found" });
  });
});
