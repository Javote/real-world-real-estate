import type { RequestHandler } from "express";
import { OpenAPIHandler } from "../lib/orpc.js";
import { type Contexto, contextoDeRequest } from "./contexto.js";

export const PREFIJO_API = "/api/v1";

/**
 * El router oRPC raíz. Vacío en A2 (SPEC-607): cada vertical se muda acá en A3/A4 y borra sus rutas de
 * Express. Lo que no conoce lo siguen atendiendo las de Express.
 */
export const routerRaiz: Record<string, never> = {};

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
