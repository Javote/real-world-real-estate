import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler as OpenAPIHandlerBase } from "@orpc/openapi/node";
import { type Context as ContextType, call, ORPCError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Request, RequestHandler } from "express";
import { Sentry } from "../instrumentation.js";

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
type ArgContexto<T extends ContextType> =
  Record<never, never> extends T
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
