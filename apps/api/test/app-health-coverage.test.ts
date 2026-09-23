import type { Express } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

// SPEC-018 §A6 — `app.ts` no tenía ningún test propio para `/health` ni para
// el 404 final: los dos son funciones que ninguna otra suite HTTP ejercita
// de pasada (todas piden rutas de negocio bajo `/api/v1/...`).
//
// Cada test reimporta `app` con `vi.resetModules()` — así el 503 puede
// mockear `lib/kysely` sin filtrar ese mock a los otros tests del archivo.
// `../src/lib/db` se importa ANTES que `../src/app` (no en paralelo) para
// garantizar que sea la misma instancia de Kysely que el `/health` de la app
// recién importada va a usar — y así se puede cerrar prolijo en el afterEach.

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

describe("GET /health", () => {
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

describe("una ruta que no existe", () => {
  it("404 en JSON, no la página HTML default de Express", async () => {
    const app = await appFresca();

    const respuesta = await request(app).get("/api/v1/no-existe-esta-ruta");

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ message: "Not found" });
  });
});
