import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCHIVO_OPENAPI, buildOpenApiDocument } from "../scripts/generate-openapi.js";

describe("api-docs/propnexus.openapi.json", () => {
  it("coincide con lo que generaría el router montado ahora mismo", async () => {
    const commiteado = readFileSync(ARCHIVO_OPENAPI, "utf-8");
    const fresco = `${JSON.stringify(await buildOpenApiDocument(), null, 2)}\n`;

    expect(commiteado).toBe(fresco);
  });
});
