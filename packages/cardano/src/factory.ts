import type { Network } from "@lucid-evolution/lucid";
import type { LedgerStore } from "./ledger";
import { ANCHOR_MODES, type AnchorMode, type AnchorPort } from "./port";
import type { LucidAnchorAdapter, ReferenceScriptPublication } from "./real";
import { SimulatedAnchorAdapter } from "./simulated";

export const REDES_PERMITIDAS = ["Preprod", "Preview", "Custom"] as const;
export type RedPermitida = (typeof REDES_PERMITIDAS)[number];

const BLOCKFROST_URL: Record<string, string> = {
  Preprod: "https://cardano-preprod.blockfrost.io/api/v0",
  Preview: "https://cardano-preview.blockfrost.io/api/v0"
};

export interface AnchorPortOptions {
  mode?: string | undefined;
  store?: LedgerStore | undefined;
  blockfrostApiKey?: string | undefined;
  privateKey?: string | undefined;
  network?: string | undefined;
  blockfrostUrl?: string | undefined;
}

function requerida(valor: string | undefined, nombre: string): string {
  const limpio = valor?.trim();
  if (!limpio) {
    throw new Error(`ANCHOR_MODE=real exige ${nombre}, y no está definida`);
  }
  return limpio;
}

function validarRed(valor: string | undefined): RedPermitida {
  const network = (valor ?? "Preprod") as RedPermitida;
  if (!REDES_PERMITIDAS.includes(network)) {
    throw new Error(
      `CARDANO_NETWORK="${network}" no está permitida. Valores posibles: ` +
        `${REDES_PERMITIDAS.join(" | ")}. Mainnet está fuera de alcance (D-013).`
    );
  }
  return network;
}

function urlDeBlockfrost(explicita: string | undefined, network: RedPermitida): string {
  const url = explicita?.trim() || BLOCKFROST_URL[network];
  if (!url) {
    throw new Error(
      `No hay URL de Blockfrost para la red "${network}". Pasá blockfrostUrl explícita.`
    );
  }
  return url;
}

export async function createAnchorPort(options: AnchorPortOptions): Promise<AnchorPort> {
  const mode = (options.mode ?? "simulated") as AnchorMode;

  if (!ANCHOR_MODES.includes(mode)) {
    throw new Error(
      `ANCHOR_MODE inválido: "${mode}". Valores posibles: ${ANCHOR_MODES.join(" | ")}`
    );
  }

  if (mode === "simulated") {
    return new SimulatedAnchorAdapter(options.store ? { store: options.store } : {});
  }

  return crearAdaptadorReal(options);
}

async function crearAdaptadorReal(options: AnchorPortOptions): Promise<LucidAnchorAdapter> {
  const network = validarRed(options.network);
  const apiKey = requerida(options.blockfrostApiKey, "BLOCKFROST_API_KEY");
  const privateKey = requerida(options.privateKey, "SERVICE_WALLET_PRIVATE_KEY");
  const url = urlDeBlockfrost(options.blockfrostUrl, network);

  // Perezoso y después de validar: Lucid cuesta ~2 s y ~120 MB, y `simulated`/`disabled` no lo usan.
  const [{ Blockfrost, Lucid }, { LucidAnchorAdapter }] = await Promise.all([
    import("@lucid-evolution/lucid"),
    import("./real.js")
  ]);

  const lucid = await Lucid(new Blockfrost(url, apiKey), network as Network);
  lucid.selectWallet.fromPrivateKey(privateKey);

  return LucidAnchorAdapter.create({
    lucid,
    network: network as Network,
    blockfrost: { url, apiKey }
  });
}

export async function publicarReferenceScript(
  options: AnchorPortOptions
): Promise<ReferenceScriptPublication & { walletAddress: string; scriptAddress: string }> {
  const adaptador = await crearAdaptadorReal(options);
  const publicacion = await adaptador.publishReferenceScript();

  return {
    ...publicacion,
    walletAddress: adaptador.walletAddress,
    scriptAddress: adaptador.address
  };
}
