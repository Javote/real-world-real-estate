import { ORPCError, os } from "../lib/orpc.js";
import type { Contexto } from "../platform/contexto.js";
import {
  autorizar,
  type LectorDeParam,
  type ReglaDeAutorizacion,
  sesionDesde,
  type Usuario,
  type Veredicto
} from "./auth.js";

/**
 * El guard de un procedimiento, la misma forma que `authorize({ roles, acceso })` (D-088). Las rutas
 * públicas lo dicen explícito con `sinSesion`: ninguna queda abierta por omisión.
 */
export type Guard = ReglaDeAutorizacion | { sinSesion: true };

export type MetaDeProcedimiento = { guard?: Guard };

/** Lo que el guard agrega al contexto para el handler. */
export type ContextoAutorizado = { usuario: Usuario | null; proyectoId: string | null };

// Para oRPC, path y body son los dos `input`, todavía sin validar: el guard corre antes que el schema.
const paramsDeInput =
  (input: unknown): LectorDeParam =>
  (param) => {
    const valor = (input as Record<string, unknown> | undefined)?.[param];
    if (typeof valor !== "string" || !valor) {
      return { ok: false, status: 400, message: `Missing or invalid "${param}"` };
    }
    return valor;
  };

function rechazar({ status, message }: Exclude<Veredicto, { ok: true }>): never {
  if (status === 403) throw new ORPCError("FORBIDDEN", { message });
  if (status === 404) throw new ORPCError("NOT_FOUND", { message });
  // 400: un param que falta en el input. El 500 de Express (un param de path mal declarado) acá no
  // existe: para oRPC el path también es input.
  throw new ORPCError("BAD_REQUEST", { message });
}

/**
 * `authenticate` + `authorize` para un procedimiento oRPC, leyendo el guard de su `meta`. Corre antes
 * de validar el input (SPEC-607 invariante 2): sin sesión es 401 aunque el body sea inválido, y un rol
 * sin permiso es 403 antes que un 400. Los mismos mensajes que Express.
 */
export const guardOrpc = os
  .$context<Contexto>()
  .$meta<MetaDeProcedimiento>({})
  .middleware(async ({ context, next, procedure }, input) =>
    next({ context: await aplicarGuard(procedure["~orpc"].meta.guard, context, input) })
  );

async function aplicarGuard(
  guard: Guard | undefined,
  context: Contexto,
  input: unknown
): Promise<ContextoAutorizado> {
  if (!guard) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Route misconfiguration: procedure without guard"
    });
  }

  if ("sinSesion" in guard) return { usuario: null, proyectoId: null };

  const sesion = sesionDesde(context.authorization);
  if ("rechazo" in sesion) throw new ORPCError("UNAUTHORIZED", { message: sesion.rechazo });

  const resultado = await autorizar(sesion, paramsDeInput(input), guard);
  if ("rechazo" in resultado) throw new ORPCError("UNAUTHORIZED", { message: resultado.rechazo });

  const { usuario, veredicto } = resultado;
  if (!veredicto.ok) rechazar(veredicto);

  return { usuario, proyectoId: veredicto.proyectoId ?? null };
}
