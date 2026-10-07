import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPEC-618: ninguna escritura usa `db.transaction()` sin su motivo escrito en la línea de arriba,
// con la forma `// transacción: <por qué no alcanza un enLote>`. Sobre libSQL local, la que pierde una
// carrera tira `SQLITE_BUSY`; sobre Turso retiene la escritura durante todos sus viajes.
const SRC = path.join(import.meta.dirname, "..", "src");

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? archivos(path.join(dir, e.name))
      : e.name.endsWith(".ts")
        ? [path.join(dir, e.name)]
        : []
  );
}

describe("transacciones interactivas en src/", () => {
  it("cada `.transaction()` lleva su motivo en la línea de arriba", () => {
    const sinMotivo = archivos(SRC).flatMap((archivo) => {
      const lineas = readFileSync(archivo, "utf-8").split("\n");
      return lineas.flatMap((linea, i) =>
        /\.transaction\(\)/.test(linea) &&
        !/^\s*(\/\/|\/\*|\*)/.test(linea) &&
        !/^\s*\/\/ transacción: \S/.test(lineas[i - 1] ?? "")
          ? [`${path.relative(SRC, archivo)}:${i + 1}`]
          : []
      );
    });
    expect(sinMotivo).toEqual([]);
  });
});
