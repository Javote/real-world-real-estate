import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { conUsuario, delegarAOrpc, type OpenAPIHandler } from "../src/lib/orpc";

// SPEC-018 §Paso 0 — el puente Express → oRPC que reemplazó las 89 copias de
// `if (!matched) next()`. Por HTTP `matched` es siempre `true` (Express ya
// matcheó el path antes de delegar), así que la rama que devuelve el control a
// Express solo se puede probar acá, con un handler falso.

type Contexto = { user: { id: string; email: string; role: "admin" } };

function handlerFalso<T extends Record<string, unknown>>(matched: boolean) {
  const handle = vi.fn().mockResolvedValue({ matched });
  return { handler: { handle } as unknown as OpenAPIHandler<T>, handle };
}

const req = { user: { id: "u-1", email: "a@example.com", role: "admin" } } as unknown as Request;
const res = {} as Response;

describe("delegarAOrpc", () => {
  it("si oRPC no matchea, le devuelve el control a Express con next()", async () => {
    const { handler } = handlerFalso<Record<never, never>>(false);
    const next = vi.fn() as unknown as NextFunction;

    await delegarAOrpc(handler, "/api/v1/x")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("si oRPC matchea, ya contestó: no llama a next()", async () => {
    const { handler } = handlerFalso<Record<never, never>>(true);
    const next = vi.fn() as unknown as NextFunction;

    await delegarAOrpc(handler, "/api/v1/x")(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("sin contexto le pasa {} y el prefijo absoluto", async () => {
    const { handler, handle } = handlerFalso<Record<never, never>>(true);

    await delegarAOrpc(handler, "/api/v1/x")(req, res, vi.fn() as unknown as NextFunction);

    expect(handle).toHaveBeenCalledWith(req, res, { prefix: "/api/v1/x", context: {} });
  });

  it("con conUsuario le pasa el usuario que authenticate dejó en la request", async () => {
    const { handler, handle } = handlerFalso<Contexto>(true);

    await delegarAOrpc(handler, "/api/v1/x", conUsuario)(
      req,
      res,
      vi.fn() as unknown as NextFunction
    );

    expect(handle).toHaveBeenCalledWith(req, res, {
      prefix: "/api/v1/x",
      context: { user: req.user }
    });
  });
});
