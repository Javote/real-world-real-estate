import { os } from "../lib/orpc.js";
import { type Guard, guardOrpc, type MetaDeProcedimiento } from "../middlewares/guard-orpc.js";
import type { Contexto } from "./contexto.js";

// No se exporta: un procedimiento nace de `procedimiento(guard)`, así que uno sin guard no compila.
const base = os.$context<Contexto>().$meta<MetaDeProcedimiento>({}).use(guardOrpc);

/**
 * El único punto de entrada para un procedimiento oRPC nuevo. El guard queda como dato en la `meta`
 * (lo lee `route-guards.test.ts`) y `guardOrpc` lo aplica antes de validar el input.
 */
export const procedimiento = (guard: Guard) => base.meta({ guard });
