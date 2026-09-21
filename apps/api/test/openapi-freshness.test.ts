import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "../scripts/generate-openapi";

// Mismo patrón que api-docs-freshness.test.ts, para el otro documento que lee
// el router montado. Si este test se pone rojo, corré
// `pnpm --filter @plataforma/api docs:openapi` y commiteá el resultado —
// actualizarlo ES la revisión.
describe("specs/evidencia-m3/2-api/openapi/propnexus.openapi.json", () => {
  it("coincide con lo que generaría el router montado ahora mismo", async () => {
    const archivo = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "specs",
      "evidencia-m3",
      "2-api",
      "openapi",
      "propnexus.openapi.json"
    );
    const commiteado = readFileSync(archivo, "utf-8");
    const fresco = `${JSON.stringify(await buildOpenApiDocument(), null, 2)}\n`;

    expect(commiteado).toBe(fresco);
  });
});
