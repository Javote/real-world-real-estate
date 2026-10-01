import { MONTAJE } from "../app";
import {
  type GuardDescriptor,
  leerGuard,
  type ReglaDeAcceso,
  type ReglaSimple
} from "../middlewares/auth";
import { en } from "./arrays";

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

export function matrizViva(): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const { rutas } of leerMontaje()) {
    for (const [clave, guards] of rutas) {
      salida[clave] = guards.map(describir).join(" + ") || "—";
    }
  }
  return salida;
}
