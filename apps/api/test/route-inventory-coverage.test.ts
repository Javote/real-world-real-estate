import { beforeAll, describe, expect, it, vi } from "vitest";

interface CapaSintetica {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle: unknown;
}

const { routerSintetico } = vi.hoisted(() => {
  const middlewareSinMarcar = () => undefined;
  const handlerDeNegocio = () => undefined;
  const stack: CapaSintetica[] = [
    { handle: middlewareSinMarcar },
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

vi.mock("../src/app.js", () => ({ MONTAJE: [{ prefijo: "", router: routerSintetico }] }));

// El primer import arrastra todo el grafo de route-inventory: con la cobertura instrumentando y la
// CPU compartida se pasaba de los 5 s de un test. Se carga una vez, con su propio tope.
let inventario: typeof import("../src/lib/route-inventory.js");
beforeAll(async () => {
  inventario = await import("../src/lib/route-inventory.js");
}, 30_000);

describe("leerMontaje con un router sintético", () => {
  it("un middleware de router sin GUARD no se agrega a guardsDeRouter", () => {
    const montaje = inventario.leerMontaje().at(0);

    expect(montaje?.guardsDeRouter).toEqual([]);
  });

  it('un path que queda vacío tras sacarle la barra final se sirve como "/"', () => {
    const montaje = inventario.leerMontaje().at(0);

    expect(montaje?.rutas.has("GET /")).toBe(true);
  });
});

describe("matrizViva con el mismo router sintético", () => {
  it('la ruta "/" aparece sin guards (—)', () => {
    expect(inventario.matrizViva()["GET /"]).toBe("—");
  });
});
