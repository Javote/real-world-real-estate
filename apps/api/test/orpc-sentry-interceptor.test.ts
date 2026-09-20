import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAPIHandler, ORPCError, os } from "../src/lib/orpc";

// `Sentry` en `instrumentation.ts` es `import * as Sentry from "@sentry/node"`
// re-exportado — un namespace ESM, no configurable, así que `vi.spyOn` sobre
// él tira "Module namespace is not configurable". Se mockea el paquete
// entero en su lugar, conservando el resto (`init`, `setupExpressErrorHandler`,
// que `app.ts`/`instrumentation.ts` también usan).
const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn((_error: unknown) => "id")
}));
vi.mock("@sentry/node", async (importOriginal) => {
  const real = await importOriginal<typeof import("@sentry/node")>();
  return { ...real, captureException };
});

// SPEC-212 — cierra la investigación pendiente ("Pendiente — investigar más
// a fondo: `OpenAPIHandler` nunca llama a `next(err)`"): el interceptor
// genérico agregado en `lib/orpc.ts` tiene que reportar a Sentry un error NO
// clasificado y quedarse callado ante un rechazo de negocio declarado
// (`.errors({...})`) — es el mismo filtro que `statusDeError` ya aplica del
// lado de `errorHandler.ts`/`app.ts`, ahora del lado de oRPC.
//
// Router mínimo, standalone — no `app.ts`: lo único bajo prueba es que
// `new OpenAPIHandler(...)` (el export de `lib/orpc.ts`, no el de
// `@orpc/openapi/node` directo) engancha el interceptor, sin depender de
// `authorize` ni de ninguna ruta real.
const PREFIJO_ABSOLUTO = "/probe";

const throwsUnclassifiedProcedure = os
  .route({ method: "GET", path: "/unclassified" })
  .handler(() => {
    throw new Error("boom, sin clasificar");
  });

const throwsDefinedProcedure = os
  .errors({ ALGO_CONOCIDO: { status: 409, message: "conflicto de negocio" } })
  .route({ method: "GET", path: "/defined" })
  .handler(({ errors }) => {
    throw errors.ALGO_CONOCIDO({ message: "conflicto de negocio" });
  });

function montarApp() {
  const app = express();
  const unclassifiedHandler = new OpenAPIHandler({ throwsUnclassifiedProcedure });
  const definedHandler = new OpenAPIHandler({ throwsDefinedProcedure });

  app.get("/probe/unclassified", async (req, res, next) => {
    const { matched } = await unclassifiedHandler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
    if (!matched) next();
  });
  app.get("/probe/defined", async (req, res, next) => {
    const { matched } = await definedHandler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
    if (!matched) next();
  });
  return app;
}

describe("el interceptor de Sentry de lib/orpc.ts (SPEC-212)", () => {
  beforeEach(() => {
    captureException.mockClear();
  });

  it("un error no clasificado se reporta a Sentry, y la respuesta sigue siendo el 500 genérico de oRPC", async () => {
    const app = montarApp();

    const res = await request(app).get("/probe/unclassified");

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it("un ORPCError declarado con .errors({...}) NO se reporta — es un rechazo de negocio, no un fallo", async () => {
    const app = montarApp();

    const res = await request(app).get("/probe/defined");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ALGO_CONOCIDO");
    expect(captureException).not.toHaveBeenCalled();
  });

  it("un ORPCError sin nombre (no declarado) sigue reportándose — `defined` es lo que decide, no la clase", async () => {
    const throwsUndefinedOrpcError = os
      .route({ method: "GET", path: "/undefined-orpc" })
      .handler(() => {
        throw new ORPCError("NOT_FOUND", { message: "no existe" });
      });
    const app = express();
    const handler = new OpenAPIHandler({ throwsUndefinedOrpcError });
    app.get("/probe/undefined-orpc", async (req, res, next) => {
      const { matched } = await handler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
      if (!matched) next();
    });

    const res = await request(app).get("/probe/undefined-orpc");

    expect(res.status).toBe(404);
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
