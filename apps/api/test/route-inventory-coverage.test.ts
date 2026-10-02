import { describe, expect, it, vi } from "vitest";

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
