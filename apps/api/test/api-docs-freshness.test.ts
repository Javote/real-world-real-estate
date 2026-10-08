import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCHIVO_POSTMAN, buildPostmanCollection } from "../scripts/generate-api-docs.js";

describe("api-docs/propnexus.postman_collection.json", () => {
  it("coincide con lo que generaría el router montado ahora mismo", () => {
    const commiteado = readFileSync(ARCHIVO_POSTMAN, "utf-8");
    const fresco = `${JSON.stringify(buildPostmanCollection(), null, 2)}\n`;

    expect(commiteado).toBe(fresco);
  });
});
