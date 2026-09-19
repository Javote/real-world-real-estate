import { describe, expectTypeOf, it } from "vitest";
import type { Serialized } from "./serialize";

// SPEC-109 (F-13) — aserciones de TIPO, no de runtime: `Serialized<T>` no
// existe en tiempo de ejecución, es una transformación que el compilador
// aplica. `expectTypeOf` falla el build si la forma derivada no es la
// esperada — es la red que sostiene la invariante 2 de la spec ("el tipo que
// el front usa es el serializado, no el inferido crudo").

describe("Serialized<T>", () => {
  it("convierte Date a string, y deja todo lo demás igual", () => {
    interface Origen {
      id: string;
      count: number;
      createdAt: Date;
    }
    expectTypeOf<Serialized<Origen>>().toEqualTypeOf<{
      id: string;
      count: number;
      createdAt: string;
    }>();
  });

  it("recorre objetos anidados", () => {
    interface Origen {
      stage: { name: string; certifiedAt: Date | null };
    }
    expectTypeOf<Serialized<Origen>>().toEqualTypeOf<{
      stage: { name: string; certifiedAt: string | null };
    }>();
  });

  it("recorre arrays de objetos con Date", () => {
    interface Origen {
      stages: { name: string; createdAt: Date }[];
    }
    expectTypeOf<Serialized<Origen>>().toEqualTypeOf<{
      stages: { name: string; createdAt: string }[];
    }>();
  });

  it("una unión con null sobrevive — Date | null se serializa a string | null, no a string", () => {
    expectTypeOf<Serialized<Date | null>>().toEqualTypeOf<string | null>();
  });

  it("una unión de literales de string (un enum de Zod) no se toca", () => {
    type Estado = "Pending" | "Completed";
    expectTypeOf<Serialized<Estado>>().toEqualTypeOf<Estado>();
  });
});
