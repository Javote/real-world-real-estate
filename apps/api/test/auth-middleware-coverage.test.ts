import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { authorize, CUALQUIER_ROL, leerGuard } from "../src/middlewares/auth";
import { errorHandler } from "../src/middlewares/errorHandler";
import { dossierRateLimitMax } from "../src/middlewares/rateLimit";
import { FIXTURES } from "./global-setup";

// SPEC-018 §A4 — middlewares (`auth.ts`, `errorHandler.ts`, `rateLimit.ts`) y
// las dos rutas admin-only (`auth.routes.ts`, `users.routes.ts`).

afterAll(async () => {
  await db.destroy();
});

/** Un `res` de Express falso, con `status().json()` encadenable y espiable. */
function fakeRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res) as unknown as Response["status"];
  res.json = vi.fn().mockReturnValue(res) as unknown as Response["json"];
  return res;
}

describe("leerGuard con algo que no es función", () => {
  it("devuelve null", () => {
    expect(leerGuard("no soy una función")).toBeNull();
    expect(leerGuard(undefined)).toBeNull();
  });
});

describe("authorize sin req.user", () => {
  it("401, sin tocar la base", async () => {
    const mw = authorize({ roles: CUALQUIER_ROL, acceso: "soloRol" });
    const res = fakeRes();
    const next = vi.fn();

    await mw({ params: {} } as unknown as Request, res, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("leerParam · el path no trae el param (ruta mal declarada)", () => {
  it("regla `proyecto`: 500 explícito, no un array ni undefined en silencio", async () => {
    const mw = authorize({
      roles: ["admin"],
      acceso: { proyecto: { param: "falta" }, membresias: ["developer"] }
    });
    const res = fakeRes();
    const next = vi.fn();

    await mw(
      { user: { id: "u", email: "a@test.local", role: "admin" }, params: {} } as unknown as Request,
      res,
      next as NextFunction
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('param "falta"') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("regla `dueño`: mismo 500, por el mismo motivo", async () => {
    const mw = authorize({
      roles: CUALQUIER_ROL,
      acceso: { dueño: { via: "Unit", param: "falta" } }
    });
    const res = fakeRes();
    const next = vi.fn();

    await mw(
      { user: { id: "u", email: "a@test.local", role: "buyer" }, params: {} } as unknown as Request,
      res,
      next as NextFunction
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('param "falta"') })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("`alguna` · un 500 gana incluso sobre una rama que pasa", () => {
  it("no tapa la ruta mal declarada con el OK de `soloRol`", async () => {
    const mw = authorize({
      roles: ["admin"],
      acceso: {
        alguna: [{ proyecto: { param: "falta" }, membresias: ["developer"] }, "soloRol"]
      }
    });
    const res = fakeRes();
    const next = vi.fn();

    await mw(
      { user: { id: "u", email: "a@test.local", role: "admin" }, params: {} } as unknown as Request,
      res,
      next as NextFunction
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("una CertifierInvitation inexistente", () => {
  it("da 404, no 403 — la carga la hace `authorize({ dueño })`", async () => {
    const token = (
      await request(app).post("/api/v1/auth/login").send({
        email: FIXTURES.certificador.email,
        password: FIXTURES.certificador.password
      })
    ).body.token as string;

    const res = await request(app)
      .post(`/api/v1/certifier/invitations/${createId()}/accept`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe("errorHandler", () => {
  it("con `res.headersSent`, delega a `next(err)` en vez de reescribir el status", () => {
    const err = new Error("da igual");
    const res = fakeRes();
    res.headersSent = true;
    const next = vi.fn();

    errorHandler(err, {} as Request, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("un error de restricción SQLite da 409, sin pasar por ninguna ruta oRPC", () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("UNIQUE constraint failed: Project.slug"), {
      code: "SQLITE_CONSTRAINT_UNIQUE"
    });
    const res = fakeRes();
    const next = vi.fn();

    errorHandler(err, {} as Request, res, next as NextFunction);
    silencio.mockRestore();

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Resource already exists",
      code: "RESOURCE_ALREADY_EXISTS"
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("dossierRateLimitMax con un valor válido en el entorno", () => {
  it("usa ese valor y no el default", () => {
    expect(dossierRateLimitMax({ DOSSIER_RATE_LIMIT_MAX: "5" } as NodeJS.ProcessEnv)).toBe(5);
  });
});

describe("PATCH /api/v1/users/:id de un usuario inexistente", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = (
      await request(app)
        .post("/api/v1/auth/login")
        .send({ email: FIXTURES.admin.email, password: FIXTURES.admin.password })
    ).body.token;
  });

  it("da 404, no el 500 genérico que `executeTakeFirstOrThrow` producía", async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${createId()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ fullName: "no importa" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User not found");
  });
});
