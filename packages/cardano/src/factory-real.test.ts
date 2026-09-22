import { describe, expect, it, vi } from "vitest";

// Este archivo mockea Lucid y `./real.js` a propósito: el camino feliz de
// `crearAdaptadorReal` sale a la red (Blockfrost) y ya está cubierto contra
// un nodo de verdad en `yaci.test.ts` (manual, no en CI). Lo que este test
// cubre es el CABLEADO — que factory.ts arme Lucid con la URL/red correctas,
// seleccione la wallet con la clave dada, y pase la instancia al adaptador —
// sin pagar el costo ni la flakiness de una llamada real.
const fromPrivateKey = vi.fn();
const lucidMock = { selectWallet: { fromPrivateKey } };
const Lucid = vi.fn().mockResolvedValue(lucidMock);
// Tiene que ser construible con `new` — factory.ts hace `new Blockfrost(url, apiKey)`.
function Blockfrost(this: { url: string; apiKey: string }, url: string, apiKey: string) {
  this.url = url;
  this.apiKey = apiKey;
}
const BlockfrostMock = vi.fn(Blockfrost);

vi.mock("@lucid-evolution/lucid", () => ({ Lucid, Blockfrost: BlockfrostMock }));

const create = vi.fn().mockResolvedValue({
  walletAddress: "addr_test1vwallet",
  address: "addr_test1vscript",
  publishReferenceScript: vi.fn().mockResolvedValue({
    outputRef: "a".repeat(64) + "#0",
    txid: null,
    lovelace: 2_000_000n
  })
});

vi.mock("./real.js", () => ({ LucidAnchorAdapter: { create } }));

const { createAnchorPort, publicarReferenceScript } = await import("./factory");

describe("crearAdaptadorReal — el cableado, con Lucid mockeado", () => {
  it("arma Blockfrost con la URL default de Preprod y selecciona la wallet con la clave dada", async () => {
    const puerto = await createAnchorPort({
      mode: "real",
      blockfrostApiKey: "clave-api",
      privateKey: "clave-privada"
    });

    expect(BlockfrostMock).toHaveBeenCalledWith(
      "https://cardano-preprod.blockfrost.io/api/v0",
      "clave-api"
    );
    expect(Lucid).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.any(String) }),
      "Preprod"
    );
    expect(fromPrivateKey).toHaveBeenCalledWith("clave-privada");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ lucid: lucidMock, network: "Preprod" })
    );
    expect(puerto).toBe(await create.mock.results[0]?.value);
  });

  it("una blockfrostUrl explícita pisa la default de la red", async () => {
    await createAnchorPort({
      mode: "real",
      network: "Preview",
      blockfrostApiKey: "k",
      privateKey: "s",
      blockfrostUrl: "https://devnet.local/api/v0"
    });

    expect(BlockfrostMock).toHaveBeenCalledWith("https://devnet.local/api/v0", "k");
  });

  it("Custom sin blockfrostUrl explícita rechaza — no hay default para esa red", async () => {
    await expect(
      createAnchorPort({ mode: "real", network: "Custom", blockfrostApiKey: "k", privateKey: "s" })
    ).rejects.toThrow(/No hay URL de Blockfrost/);
  });

  it("publicarReferenceScript devuelve datos planos, no la instancia de Lucid", async () => {
    const resultado = await publicarReferenceScript({
      mode: "real",
      blockfrostApiKey: "k",
      privateKey: "s"
    });

    expect(resultado).toEqual({
      outputRef: expect.any(String),
      txid: null,
      lovelace: 2_000_000n,
      walletAddress: "addr_test1vwallet",
      scriptAddress: "addr_test1vscript"
    });
  });
});
