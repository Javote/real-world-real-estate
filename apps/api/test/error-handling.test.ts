import express from "express";
import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
import { db } from "../src/lib/db.js";
import { HttpError } from "../src/lib/http-error.js";
import { errorHandler } from "../src/middlewares/errorHandler.js";

afterAll(async () => {
  await db.destroy();
});

function appDePrueba() {
  const app = express();
  app.use(express.json());

  app.get("/async-explota", async () => {
    throw new Error("SELECT * FROM User — detalle interno que NO debe salir");
  });

  app.get("/sync-explota", () => {
    throw new Error("otro detalle interno");
  });

  app.get("/http-error", async () => {
    throw new HttpError(422, "Mensaje escrito para el cliente");
  });

  app.get("/rechaza", async (_req, _res) => Promise.reject(new Error("rechazo directo")));

  app.use(errorHandler);
  return app;
}

describe("un handler async que falla no cuelga la request ni mata el proceso", () => {
  it("un throw dentro de un handler async llega al errorHandler", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appDePrueba()).get("/async-explota");
    silencio.mockRestore();

    expect(res.status).toBe(500);
  });

  it("una promesa rechazada sin throw también llega", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appDePrueba()).get("/rechaza");
    silencio.mockRestore();

    expect(res.status).toBe(500);
  });

  it("el throw síncrono sigue llegando igual que antes", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appDePrueba()).get("/sync-explota");
    silencio.mockRestore();

    expect(res.status).toBe(500);
  });
});

describe("el errorHandler no le echa la culpa al cliente ni filtra el motivo", () => {
  it("un error inesperado es 500, no 400", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appDePrueba()).get("/async-explota");
    silencio.mockRestore();

    expect(res.status).toBe(500);
    expect(res.status).not.toBe(400);
  });

  it("el cuerpo NO contiene el mensaje interno", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appDePrueba()).get("/async-explota");
    silencio.mockRestore();

    expect(res.body).toEqual({ message: "Internal server error" });
    expect(JSON.stringify(res.body)).not.toContain("SELECT");
    expect(JSON.stringify(res.body)).not.toContain("User");
  });

  it("pero el detalle SÍ queda en el log del servidor — es donde se mira", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    await request(appDePrueba()).get("/async-explota");

    expect(espia).toHaveBeenCalled();
    const loggeado = espia.mock.calls.flat().map(String).join(" ");
    expect(loggeado).toContain("SELECT");
    espia.mockRestore();
  });

  it("un HttpError sí muestra su mensaje, con su status", async () => {
    const res = await request(appDePrueba()).get("/http-error");

    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Mensaje escrito para el cliente");
  });
});
