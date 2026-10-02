import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPostmanCollection } from "../scripts/generate-api-docs.js";

describe("specs/evidencia-m3/2-api/postman/propnexus.postman_collection.json", () => {
  it("coincide con lo que generaría el router montado ahora mismo", () => {
    const archivo = path.join(
      import.meta.dirname,
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
