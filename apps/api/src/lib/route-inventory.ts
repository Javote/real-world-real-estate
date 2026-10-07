import { MONTAJE } from "../app.js";
import {
  type GuardDescriptor,
  leerGuard,
  type ReglaDeAcceso,
  type ReglaSimple
} from "../middlewares/auth.js";
import type { Guard } from "../middlewares/guard-orpc.js";
import { PREFIJO_API, routerRaiz } from "../platform/router.js";
import { en } from "./arrays.js";

type Capa = {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle: unknown;
};

export type Montaje = {
  prefijo: string;
  guardsDeRouter: GuardDescriptor[];
  rutas: Map<string, GuardDescriptor[]>;
  handlers: Map<string, unknown>;
};

export function ramas(acceso: ReglaDeAcceso): ReglaSimple[] {
  return typeof acceso !== "string" && "alguna" in acceso ? [...acceso.alguna] : [acceso];
}

export function describirSimple(regla: ReglaSimple): string {
  if (regla === "soloRol") return "soloRol";
  if ("proyecto" in regla) {
    const s = regla.proyecto;
    const origen = "via" in s ? `${s.via}:${s.param}${s.en === "body" ? "@body" : ""}` : s.param;
    return `proyecto(${origen} → ${regla.membresias.join("|")})`;
  }
  if ("scopeEnQuery" in regla) return `scope(${regla.scopeEnQuery})`;
  return `dueño(${regla.dueño.via}:${regla.dueño.param})`;
}

export function describirAcceso(acceso: ReglaDeAcceso): string {
  const partes = ramas(acceso).map(describirSimple);
  return partes.length === 1 ? en(partes, 0) : `alguna[${partes.join(" | ")}]`;
}

export function describir(guard: GuardDescriptor): string {
  if (guard.kind === "authenticate") return "auth";
  return `autoriza(rol(${guard.roles.join("|")}) · ${describirAcceso(guard.acceso)})`;
}

function scopeEnIngles(scope: string): string {
  return scope
    .replace("cualquier membresía", "any membership")
    .replace(/= usuario\b/, "= current user");
}

function describeRuleEn(regla: ReglaSimple): string {
  if (regla === "soloRol") return "role only";
  if ("proyecto" in regla) {
    const s = regla.proyecto;
    const origen = "via" in s ? `${s.via}:${s.param}${s.en === "body" ? "@body" : ""}` : s.param;
    return `project(${origen} → ${regla.membresias.join("|")})`;
  }
  if ("scopeEnQuery" in regla) return `scope(${scopeEnIngles(regla.scopeEnQuery)})`;
  return `owner(${regla.dueño.via}:${regla.dueño.param})`;
}

export function describeGuardEn(guard: GuardDescriptor): string {
  if (guard.kind === "authenticate") return "authenticated";
  const partes = ramas(guard.acceso).map(describeRuleEn);
  const acceso = partes.length === 1 ? en(partes, 0) : `any of[${partes.join(" | ")}]`;
  return `authorize(role(${guard.roles.join("|")}) · ${acceso})`;
}

export function leerMontaje(): Montaje[] {
  return MONTAJE.map(({ prefijo, router }) => {
    const guardsDeRouter: GuardDescriptor[] = [];
    const rutas = new Map<string, GuardDescriptor[]>();
    const handlers = new Map<string, unknown>();

    for (const capa of (router as unknown as { stack: Capa[] }).stack) {
      if (!capa.route) {
        const guard = leerGuard(capa.handle);
        if (guard) guardsDeRouter.push(guard);
        continue;
      }

      const propios = capa.route.stack
        .map((s) => leerGuard(s.handle))
        .filter((g): g is GuardDescriptor => g !== null);
      const path = `${prefijo}${capa.route.path}`.replace(/\/$/, "") || "/";
      const terminal = capa.route.stack.at(-1)?.handle;

      for (const metodo of Object.keys(capa.route.methods)) {
        const clave = `${metodo.toUpperCase()} ${path}`;
        rutas.set(clave, [...guardsDeRouter, ...propios]);
        handlers.set(clave, terminal);
      }
    }

    return { prefijo, guardsDeRouter, rutas, handlers };
  });
}

type ProcedimientoOrpc = {
  "~orpc": { route: { method?: string; path?: string }; meta: { guard?: Guard }; handler: unknown };
};

const esProcedimiento = (x: unknown): x is ProcedimientoOrpc =>
  typeof x === "object" &&
  x !== null &&
  "~orpc" in x &&
  "handler" in (x as ProcedimientoOrpc)["~orpc"];

/** Los procedimientos del router oRPC, con el guard de su `meta` en la forma de Express. */
export function leerRouterOrpc(
  router: object,
  prefijo: string = PREFIJO_API
): Map<string, GuardDescriptor[]> {
  const rutas = new Map<string, GuardDescriptor[]>();

  const recorrer = (nodo: object) => {
    for (const hijo of Object.values(nodo)) {
      if (!esProcedimiento(hijo)) {
        recorrer(hijo as object);
        continue;
      }
      const { route, meta } = hijo["~orpc"];
      const path = `${prefijo}${route.path ?? ""}`.replace(/\{(\w+)\}/g, ":$1");
      const clave = `${route.method ?? "POST"} ${path}`;
      const guard = meta.guard;
      if (!guard) throw new Error(`${clave} no declara guard`);
      rutas.set(
        clave,
        "sinSesion" in guard
          ? []
          : [
              { kind: "authenticate" },
              { kind: "authorize", roles: guard.roles, acceso: guard.acceso }
            ]
      );
    }
  };
  recorrer(router);
  return rutas;
}

/** Las rutas de Express y las del router oRPC, juntas. Una ruta con dos dueños es un error. */
export function rutasConGuards(router: object = routerRaiz): Map<string, GuardDescriptor[]> {
  const todas = new Map<string, GuardDescriptor[]>();
  for (const { rutas } of leerMontaje()) {
    for (const [clave, guards] of rutas) todas.set(clave, guards);
  }
  for (const [clave, guards] of leerRouterOrpc(router)) {
    if (todas.has(clave)) throw new Error(`${clave} está en Express y en el router oRPC`);
    todas.set(clave, guards);
  }
  return todas;
}

export function matrizViva(router: object = routerRaiz): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [clave, guards] of rutasConGuards(router)) {
    salida[clave] = guards.map(describir).join(" + ") || "—";
  }
  return salida;
}
