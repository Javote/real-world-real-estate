import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPostmanCollection } from "../scripts/generate-api-docs";

// M3 §2 — el Postman commiteado tiene que ser el que `pnpm docs:api` generaría
// HOY contra el router montado, no una foto vieja. Si este test se pone rojo,
// corré `pnpm --filter @plataforma/api docs:api` y commiteá el resultado —
// igual que la matriz de permisos, actualizarlo ES la revisión.
describe("specs/evidencia-m3/2-api/postman/propnexus.postman_collection.json", () => {
  it("coincide con lo que generaría el router montado ahora mismo", () => {
    const archivo = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "specs",
      "evidencia-m3",
      "2-api",
      "postman",
      "propnexus.postman_collection.json"
    );
    const commiteado = readFileSync(archivo, "utf-8");
    const fresco = `${JSON.stringify(buildPostmanCollection(), null, 2)}\n`;

    expect(commiteado).toBe(fresco);
  });
});
