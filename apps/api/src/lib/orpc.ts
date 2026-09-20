// Los cuatro paquetes de oRPC se publican solo como ESM (mismo caso que
// `@libsql/client`/`kysely`, D-049): con `moduleResolution: node16` (CJS) un
// `import` normal falla TS1479 aunque en runtime funcione. Mismo patrón que
// `src/lib/libsql-client.ts` — tipos con `resolution-mode: "require"`,
// valores con `require()` (Node 24 lo resuelve síncrono aunque sea ESM puro).
// Centralizado acá (mismo módulo que ya probó `test/helpers/orpc.ts`, SPEC-212)
// para no repetir el patrón en cada archivo de rutas que use oRPC.
import type { OpenAPIGenerator as OpenAPIGeneratorType } from "@orpc/openapi" with { "resolution-mode": "require" };
import type { OpenAPIHandler as OpenAPIHandlerType } from "@orpc/openapi/node" with {
  "resolution-mode": "require"
};
import type { ORPCError as ORPCErrorType, os as osType } from "@orpc/server" with {
  "resolution-mode": "require"
};
// `@orpc/zod` a secas es para Zod v3 — su `ZodToJsonSchemaConverter` descarta
// cualquier schema con `_zod` adentro (la forma interna de Zod v4, que es la
// que usa este repo, D-035) y `OpenAPIGenerator` devuelve un schema vacío sin
// avisar. El subpath `/zod4` es el que corresponde acá.
import type { ZodToJsonSchemaConverter as ZodToJsonSchemaConverterType } from "@orpc/zod/zod4" with {
  "resolution-mode": "require"
};

const { OpenAPIGenerator } = require("@orpc/openapi") as { OpenAPIGenerator: typeof OpenAPIGeneratorType };
const { OpenAPIHandler } = require("@orpc/openapi/node") as { OpenAPIHandler: typeof OpenAPIHandlerType };
const { os, ORPCError } = require("@orpc/server") as { os: typeof osType; ORPCError: typeof ORPCErrorType };
const { ZodToJsonSchemaConverter } = require("@orpc/zod/zod4") as {
  ZodToJsonSchemaConverter: typeof ZodToJsonSchemaConverterType;
};

export { OpenAPIGenerator, OpenAPIHandler, ORPCError, os, ZodToJsonSchemaConverter };
