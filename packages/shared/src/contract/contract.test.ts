import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contratoMinificado } from "./minificado";

describe("contract.min.json", () => {
  it("coincide con lo que generaría el contrato ahora mismo (`pnpm --filter @plataforma/shared contract:min`)", () => {
    const commiteado = readFileSync(path.join(import.meta.dirname, "contract.min.json"), "utf-8");
    expect(commiteado).toBe(contratoMinificado());
  });

  it("no lleva schemas: solo lo que el link necesita para armar la request", () => {
    expect(contratoMinificado()).not.toMatch(/"(inputSchema|outputSchema)"/);
  });
});
