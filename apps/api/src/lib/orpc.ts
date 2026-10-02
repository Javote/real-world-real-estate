import type { Request, RequestHandler } from "express";
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
import type { ZodToJsonSchemaConverter as ZodToJsonSchemaConverterType } from "@orpc/zod/zod4" with {
  "resolution-mode": "require"
};

// ESM puro en un package CommonJS: `require()` en runtime (Node 24) tipado con `resolution-mode`.
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

async function interceptorDeSentry(opts: { next: () => Promise<unknown> }) {
  try {
    return await opts.next();
  } catch (e) {
    if (!(e instanceof ORPCError && (e.defined || e.status < 500))) {
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

type Prefijo = `/${string}`;
type ArgContexto<T extends ContextType> = Record<never, never> extends T
  ? [contexto?: (req: Request) => T]
  : [contexto: (req: Request) => T];

function delegarAOrpc<T extends ContextType>(
  handler: OpenAPIHandler<T>,
  prefix: Prefijo,
  ...[contexto]: ArgContexto<T>
): RequestHandler {
  return async (req, res, next) => {
    const { matched } = await (handler as OpenAPIHandler<ContextType>).handle(req, res, {
      prefix,
      context: contexto ? contexto(req) : {}
    });
    if (!matched) next();
  };
}

const conUsuario = (req: Request) => ({ user: req.user! });

export {
  call,
  conUsuario,
  delegarAOrpc,
  OpenAPIGenerator,
  OpenAPIHandler,
  ORPCError,
  os,
  ZodToJsonSchemaConverter
};
