import { MONTAJE } from "../app";
import {
  type GuardDescriptor,
  leerGuard,
  type ReglaDeAcceso,
  type ReglaSimple
} from "../middlewares/auth";

// La misma introspección que sostiene `test/route-guards.test.ts` (§La matriz
// de permisos, ver `CLAUDE.md`), extraída para que un segundo consumidor
// —`scripts/generate-api-docs.ts`— no repita el árbol de Express a mano.
// **Un solo lugar interroga al router montado**; el test y el generador de
// docs solo lo leen.

/** Lo que Express expone del router ya armado. `Layer` no conserva el path de
 * montaje (lo compila a un matcher), por eso el prefijo sale de `MONTAJE`. */
type Capa = {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle: unknown;
};

export type Montaje = {
  prefijo: string;
  guardsDeRouter: GuardDescriptor[];
  rutas: Map<string, GuardDescriptor[]>;
};

/** Las ramas de una regla, siempre como lista plana. `alguna` no anida. */
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
  return partes.length === 1 ? partes[0] : `alguna[${partes.join(" | ")}]`;
}

export function describir(guard: GuardDescriptor): string {
  if (guard.kind === "authenticate") return "auth";
  return `autoriza(rol(${guard.roles.join("|")}) · ${describirAcceso(guard.acceso)})`;
}

/** Reconstruye, leyendo los routers ya montados, la matriz completa. */
export function leerMontaje(): Montaje[] {
  return MONTAJE.map(({ prefijo, router }) => {
    const guardsDeRouter: GuardDescriptor[] = [];
    const rutas = new Map<string, GuardDescriptor[]>();

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

      for (const metodo of Object.keys(capa.route.methods)) {
        rutas.set(`${metodo.toUpperCase()} ${path}`, [...guardsDeRouter, ...propios]);
      }
    }

    return { prefijo, guardsDeRouter, rutas };
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
