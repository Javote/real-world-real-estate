import { afterEach, describe, expect, it, vi } from "vitest";

const { createAnchorPort } = vi.hoisted(() => ({ createAnchorPort: vi.fn() }));

vi.mock("@plataforma/cardano", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@plataforma/cardano")>()),
  createAnchorPort
}));

const ANCHOR_MODE = process.env.ANCHOR_MODE;
const DATABASE_URL = process.env.DATABASE_URL;

function restaurar(clave: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[clave];
  else process.env[clave] = valor;
}

afterEach(() => {
  restaurar("ANCHOR_MODE", ANCHOR_MODE);
  restaurar("DATABASE_URL", DATABASE_URL);
  createAnchorPort.mockReset();
});

describe("motivoParaNoAnclar", () => {
  it("sin DATABASE_URL, no es remota — el default vacío no matchea libsql:// ni .turso.io", async () => {
    delete process.env.DATABASE_URL;
    process.env.ANCHOR_MODE = "simulated";
    vi.resetModules();
    const { motivoParaNoAnclar } = await import("../src/lib/anchor.js");

    expect(motivoParaNoAnclar()).toBeNull();
  });
});

describe("initAnchorPort", () => {
  it("si el factory tira algo que no es un Error, el puerto queda igual inhabilitado con ese texto", async () => {
    process.env.ANCHOR_MODE = "real";
    process.env.DATABASE_URL = "file:./.data/test.sqlite";
    createAnchorPort.mockRejectedValue("boom-no-es-un-error");
    vi.resetModules();
    const { initAnchorPort } = await import("../src/lib/anchor.js");

    const puerto = await initAnchorPort();

    expect(puerto.mode).toBe("disabled");
    await expect(
      puerto.anchorCommitment({ sha256: "e".repeat(64), reference: "ref-opaca" })
    ).rejects.toThrow(/boom-no-es-un-error/);
  });
});

describe("anchorPort", () => {
  it("tira si se llama antes de que initAnchorPort() haya corrido", async () => {
    vi.resetModules();
    const { anchorPort } = await import("../src/lib/anchor.js");

    expect(() => anchorPort()).toThrow(/no está inicializado/);
  });
});
