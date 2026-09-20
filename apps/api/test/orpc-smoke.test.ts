import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OpenAPIGenerator, OpenAPIHandler, os, ZodToJsonSchemaConverter } from "./helpers/orpc";

// SPEC-212 (2026-09-20): antes de tocar ninguna ruta real, esta suite prueba
// que oRPC 1.15.2 — la versión que D-066 eligió — se puede instalar, tipar y
// montar sobre el Express 5 que ya tiene este repo, SIN reemplazar el
// framework y SIN romper el patrón de "middleware corre antes del handler"
// que usa `authorize`. No toca `app.ts` ni ninguna ruta montada: es un router
// oRPC aparte, jamás cableado a `MONTAJE`.
//
// El schema es el mismo tipo de `z.strictObject` que ya usan los handlers
// reales (`packages/shared`) — no un caso simplificado a propósito.
const pingInputSchema = z.strictObject({ nombre: z.string().min(1) });
const pingOutputSchema = z.strictObject({ saludo: z.string() });

const ping = os
  .route({ method: "POST", path: "/ping" })
  .input(pingInputSchema)
  .output(pingOutputSchema)
  .handler(({ input }) => ({ saludo: `hola, ${input.nombre}` }));

const smokeRouter = { ping };

function montarRouterOrpc(app: express.Express, prefijo: `/${string}`, onAntesDeOrpc?: () => void) {
  const handler = new OpenAPIHandler(smokeRouter);
  app.use(
    prefijo,
    (_req, _res, next) => {
      // el equivalente de `authorize(...)`: un middleware Express normal,
      // corriendo ANTES de que oRPC vea la request — exactamente la cadena
      // que SPEC-212 pide conservar.
      onAntesDeOrpc?.();
      next();
    },
    async (req, res, next) => {
      const { matched } = await handler.handle(req, res, { prefix: prefijo });
      if (!matched) next();
    }
  );
}

describe("oRPC 1.15.2 sobre Express 5 — smoke test de instalación (SPEC-212)", () => {
  it("un middleware Express previo sigue corriendo, y el handler responde 200 con un body válido", async () => {
    const app = express();
    let corrioElMiddlewarePrevio = false;
    montarRouterOrpc(app, "/api/v1/smoke", () => {
      corrioElMiddlewarePrevio = true;
    });

    const respuesta = await request(app).post("/api/v1/smoke/ping").send({ nombre: "PropNexus" });

    expect(corrioElMiddlewarePrevio).toBe(true);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ saludo: "hola, PropNexus" });
  });

  it("un body que no cumple el schema Zod se rechaza sin llegar al handler", async () => {
    const app = express();
    montarRouterOrpc(app, "/api/v1/smoke");

    const respuesta = await request(app).post("/api/v1/smoke/ping").send({ nombre: "" });

    expect(respuesta.status).toBeGreaterThanOrEqual(400);
    expect(respuesta.status).toBeLessThan(500);
  });

  it("un campo de más lo rechaza el `strictObject`, igual que hoy en las rutas reales", async () => {
    const app = express();
    montarRouterOrpc(app, "/api/v1/smoke");

    const respuesta = await request(app)
      .post("/api/v1/smoke/ping")
      .send({ nombre: "PropNexus", campoDeMas: true });

    expect(respuesta.status).toBeGreaterThanOrEqual(400);
    expect(respuesta.status).toBeLessThan(500);
  });

  it("una ruta que oRPC no matchea deja pasar a la cadena de Express (`next()`), no se traga la request", async () => {
    const app = express();
    montarRouterOrpc(app, "/api/v1/smoke");
    app.get("/api/v1/smoke/otra-cosa", (_req, res) => {
      res.status(200).json({ vinoDeExpress: true });
    });

    const respuesta = await request(app).get("/api/v1/smoke/otra-cosa");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ vinoDeExpress: true });
  });

  it("`OpenAPIGenerator` produce el fragmento del path desde el router — reemplaza REQUEST_SCHEMAS/RESPONSE_SCHEMAS a mano", async () => {
    const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] });

    const documento = await generator.generate(smokeRouter, {
      info: { title: "smoke test SPEC-212", version: "0.0.0" }
    });

    const operacion = documento.paths?.["/ping"]?.post;
    expect(operacion).toBeDefined();
    expect(operacion?.requestBody).toBeDefined();
    expect(operacion?.responses?.["200"]).toBeDefined();
  });
});
