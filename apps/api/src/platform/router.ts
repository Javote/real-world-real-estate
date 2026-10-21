import type { RequestHandler } from "express";
import { OpenAPIHandler } from "../lib/orpc.js";
import { dossierRouter } from "../modules/dossier/router.js";
import { metricasRouter } from "../modules/metricas/router.js";
import { type Contexto, contextoDeRequest } from "./contexto.js";

export const PREFIJO_API = "/api/v1";

/**
 * El router oRPC raíz, que implementa el contrato de `shared` módulo por módulo (SPEC-607). Lo que no
 * conoce lo siguen atendiendo las rutas de Express hasta que su módulo se mude (A4).
 */
export const routerRaiz = { dossier: dossierRouter, metricas: metricasRouter };

/** Un solo `OpenAPIHandler` para todo `/api/v1`, montado en Express antes que las rutas viejas. */
export function montarRouter(router: object): RequestHandler {
  const handler = new OpenAPIHandler<Contexto>(router as never);
  // Con nombre: es un span de middleware más en cada request, y así se lee en la traza.
  return async function routerOrpc(req, res, next) {
    const { matched } = await handler.handle(req, res, {
      prefix: PREFIJO_API,
      context: contextoDeRequest(req)
    });
    if (!matched) next();
  };
}
