// Los cuatro paquetes de oRPC se publican solo como ESM (mismo caso que
// `@libsql/client`/`kysely`, D-049): con `moduleResolution: node16` (CJS) un
// `import` normal falla TS1479 aunque en runtime funcione. Mismo patrón que
// `src/lib/libsql-client.ts` — tipos con `resolution-mode: "require"`,
// valores con `require()` (Node 24 lo resuelve síncrono aunque sea ESM puro).
// Centralizado acá (mismo módulo que ya probó `test/helpers/orpc.ts`, SPEC-212)
// para no repetir el patrón en cada archivo de rutas que use oRPC.
import { Sentry } from "../instrumentation";

import type { OpenAPIGenerator as OpenAPIGeneratorType } from "@orpc/openapi" with { "resolution-mode": "require" };
import type { OpenAPIHandler as OpenAPIHandlerType } from "@orpc/openapi/node" with {
  "resolution-mode": "require"
};
import type {
  call as callType,
  Context as ContextType,
  ORPCError as ORPCErrorType,
  os as osType
} from "@orpc/server" with { "resolution-mode": "require" };
// `@orpc/zod` a secas es para Zod v3 — su `ZodToJsonSchemaConverter` descarta
// cualquier schema con `_zod` adentro (la forma interna de Zod v4, que es la
// que usa este repo, D-035) y `OpenAPIGenerator` devuelve un schema vacío sin
// avisar. El subpath `/zod4` es el que corresponde acá.
import type { ZodToJsonSchemaConverter as ZodToJsonSchemaConverterType } from "@orpc/zod/zod4" with {
  "resolution-mode": "require"
};

const { OpenAPIGenerator } = require("@orpc/openapi") as { OpenAPIGenerator: typeof OpenAPIGeneratorType };
const { OpenAPIHandler: OpenAPIHandlerBase } = require("@orpc/openapi/node") as {
  OpenAPIHandler: typeof OpenAPIHandlerType;
};
const { os, ORPCError, call } = require("@orpc/server") as {
  os: typeof osType;
  ORPCError: typeof ORPCErrorType;
  call: typeof callType;
};
const { ZodToJsonSchemaConverter } = require("@orpc/zod/zod4") as {
  ZodToJsonSchemaConverter: typeof ZodToJsonSchemaConverterType;
};

// SPEC-212 — el interceptor de Sentry.
//
// `OpenAPIHandler.handle()` nunca llama a `next(err)`: cualquier excepción
// que un procedimiento no capture se convierte en el 500 genérico DE ORPC,
// escrito directo sobre `res`, así que ni `errorHandler.ts` ni
// `Sentry.setupExpressErrorHandler` (que dependen de la cadena de
// middlewares de error de Express) llegan a verla — investigado y
// confirmado leyendo `@orpc/server/dist/shared/server.CMf4nKky.mjs`: no hay
// un solo `console.*` en el camino que codifica el error, así que sin esto
// un 500 real de una ruta oRPC no deja NINGÚN rastro, ni en Sentry ni en el
// log del proceso.
//
// La opción `interceptors` de `StandardHandlerOptions` envuelve el mismo
// `try/catch` que arma esa respuesta, así que un interceptor que llama a
// `next()` y relanza ve la excepción CRUDA antes de que `toORPCError()` la
// convierta — confirmado con un smoke test descartable, no adivinado.
//
// **Se envuelve acá, no se agrega llamada por llamada:** son 45
// `new OpenAPIHandler({ xProcedure })` repartidos en seis archivos de
// rutas, todos importando de este módulo. Envolver el export en vez de
// pedirle a cada call site que pase la opción es lo que hace que ninguna
// ruta nueva pueda olvidarse de reportar.
async function interceptorDeSentry(opts: { next: () => Promise<unknown> }) {
  try {
    return await opts.next();
  } catch (e) {
    // Un `ORPCError` que el propio procedimiento declaró con `.errors({...})`
    // es un rechazo de negocio esperado (un 404, un 409 de restricción), no
    // un fallo del servidor — mismo criterio que ya aplica `statusDeError`
    // para `Sentry.setupExpressErrorHandler` en `app.ts` (ver el CLAUDE.md de
    // este subárbol, "Sentry veía el error ANTES que `errorHandler`"). Sin
    // este filtro, cada 409 de negocio se reportaría como si el servidor
    // estuviera roto — exactamente el incidente del 2026-09-11 que ese
    // archivo ya documenta, repetido acá si no se replica el filtro.
    if (!(e instanceof ORPCError && e.defined)) {
      // Render no da shell (D-040): sin esto, un 500 no clasificado de una
      // ruta oRPC no queda en ningún lado más que Sentry.
      console.error("[orpc] error no clasificado", e);
      Sentry.captureException(e);
    }
    throw e;
  }
}

type OpenAPIHandlerOptionsType<T extends ContextType> = NonNullable<
  ConstructorParameters<typeof OpenAPIHandlerBase<T>>[1]
>;

class OpenAPIHandler<T extends ContextType> extends OpenAPIHandlerBase<T> {
  constructor(
    router: ConstructorParameters<typeof OpenAPIHandlerBase<T>>[0],
    options?: OpenAPIHandlerOptionsType<T>
  ) {
    super(router, {
      ...options,
      interceptors: [
        interceptorDeSentry as NonNullable<OpenAPIHandlerOptionsType<T>["interceptors"]>[number],
        ...(options?.interceptors ?? [])
      ]
    });
  }
}

export { call, OpenAPIGenerator, OpenAPIHandler, ORPCError, os, ZodToJsonSchemaConverter };
