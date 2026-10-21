import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dossierContrato } from "./dossier";
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

describe("el binario del export del dossier", () => {
  const salida = dossierContrato.investor.exportar["~orpc"].outputSchema!;

  it("acepta un File y rechaza lo que no trae sus bytes", async () => {
    const pdf = new File([new Uint8Array([1])], "dossier.pdf", { type: "application/pdf" });

    expect((await salida["~standard"].validate({ body: pdf })).issues).toBeUndefined();
    expect((await salida["~standard"].validate({ body: { size: 1 } })).issues).toBeDefined();
    expect((await salida["~standard"].validate({ body: null })).issues).toBeDefined();
  });
});
