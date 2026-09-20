import { describe, expect, it } from "vitest";
import { createAnchorPort } from "./factory";

// SPEC-411 — medido, no estimado: `@lucid-evolution/lucid` son 2015ms y 121MB
// de heap, 453 módulos, cargados en TODO proceso que tocara este package,
// ancle o no. Este archivo vive separado de `simulated.test.ts` a propósito:
// vitest aísla `require.cache` por archivo (un fork por test file), y
// `real.test.ts` importa `./real` estático — si este chequeo compartiera
// proceso con esa suite, `require.cache` ya tendría Lucid cargado por otra
// razón y el test no probaría nada.
describe("createAnchorPort — Lucid se carga solo si hace falta", () => {
  it("modo simulated no carga Lucid", async () => {
    const puerto = await createAnchorPort({});
    expect(puerto.mode).toBe("simulated");
    expect(Object.keys(require.cache).some((k) => k.includes("lucid-evolution"))).toBe(false);
  });

  it("un ANCHOR_MODE inventado rechaza sin cargar Lucid", async () => {
    await expect(createAnchorPort({ mode: "inventado" })).rejects.toThrow(/ANCHOR_MODE inválido/);
    expect(Object.keys(require.cache).some((k) => k.includes("lucid-evolution"))).toBe(false);
  });

  it("mainnet rechaza (D-013) sin cargar Lucid — la validación va antes del import", async () => {
    await expect(
      createAnchorPort({
        mode: "real",
        network: "Mainnet",
        blockfrostApiKey: "k",
        privateKey: "s"
      })
    ).rejects.toThrow(/Mainnet está fuera de alcance/);
    expect(Object.keys(require.cache).some((k) => k.includes("lucid-evolution"))).toBe(false);
  });

  it("falta BLOCKFROST_API_KEY rechaza sin cargar Lucid", async () => {
    await expect(createAnchorPort({ mode: "real", privateKey: "s" })).rejects.toThrow(
      /exige BLOCKFROST_API_KEY/
    );
    expect(Object.keys(require.cache).some((k) => k.includes("lucid-evolution"))).toBe(false);
  });
});
