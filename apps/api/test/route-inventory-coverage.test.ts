import { describe, expect, it, vi } from "vitest";

// SPEC-018 §A6 — `lib/route-inventory.ts` recorre `MONTAJE`, importado de
// `../app` (la app real montada). Las dos ramas que `route-guards.test.ts`
// no ejercita nunca —porque la app real no tiene ningún caso así— son de
// FORMA, no de dominio: un middleware de router SIN marcar (en la app real,
// hasta `authenticate` lleva su `GUARD`) y un path que, tras sacarle el `/`
// final, queda vacío (en la app real ninguna ruta es literalmente "/" sobre
// un prefijo vacío). Se ejercitan con un Router SINTÉTICO, mockeando
// `../src/app` para que `leerMontaje` lea ESE montaje en vez del real —
// `route-guards.test.ts` sigue intacto, esta suite no lo toca.

interface CapaSintetica {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle: unknown;
}

const { routerSintetico } = vi.hoisted(() => {
  const middlewareSinMarcar = () => undefined;
  const handlerDeNegocio = () => undefined;
  const stack: CapaSintetica[] = [
    // Middleware de router SIN el símbolo GUARD: `leerGuard` devuelve `null`
    // y la rama `if (guard)` no se toma — línea 99.
    { handle: middlewareSinMarcar },
    // Prefijo "" + path "/" → tras `.replace(/\/$/, "")` queda "" → el `|| "/"`
    // de la línea 106 es lo único que evita servir una clave vacía.
    {
      handle: handlerDeNegocio,
      route: {
        path: "/",
        methods: { get: true },
        stack: [{ handle: handlerDeNegocio }]
      }
    }
  ];
  return { routerSintetico: { stack } };
});

vi.mock("../src/app", () => ({ MONTAJE: [{ prefijo: "", router: routerSintetico }] }));

describe("leerMontaje con un router sintético", () => {
  it("un middleware de router sin GUARD no se agrega a guardsDeRouter", async () => {
    const { leerMontaje } = await import("../src/lib/route-inventory.js");

    const montaje = leerMontaje().at(0);

    expect(montaje?.guardsDeRouter).toEqual([]);
  });

  it('un path que queda vacío tras sacarle la barra final se sirve como "/"', async () => {
    const { leerMontaje } = await import("../src/lib/route-inventory.js");

    const montaje = leerMontaje().at(0);

    expect(montaje?.rutas.has("GET /")).toBe(true);
  });
});

describe("matrizViva con el mismo router sintético", () => {
  it('la ruta "/" aparece sin guards (—)', async () => {
    const { matrizViva } = await import("../src/lib/route-inventory.js");

    expect(matrizViva()["GET /"]).toBe("—");
  });
});
