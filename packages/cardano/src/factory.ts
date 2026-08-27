import { Blockfrost, Lucid, type Network } from "@lucid-evolution/lucid";
import type { LedgerStore } from "./ledger";
import { ANCHOR_MODES, type AnchorMode, type AnchorPort } from "./port";
import { LucidAnchorAdapter } from "./real";
import { SimulatedAnchorAdapter } from "./simulated";

/**
 * Redes permitidas. **Mainnet no está**, y no es un olvido: D-013 la deja fuera
 * del alcance y este validador no custodia valor (D-021), así que no hay ningún
 * caso en que apuntar a mainnet sea lo correcto. Si alguna vez lo es, es una
 * decisión nueva y se agrega acá a propósito, no por configuración.
 */
export const REDES_PERMITIDAS = ["Preprod", "Preview", "Custom"] as const;
export type RedPermitida = (typeof REDES_PERMITIDAS)[number];

const BLOCKFROST_URL: Record<string, string> = {
  Preprod: "https://cardano-preprod.blockfrost.io/api/v0",
  Preview: "https://cardano-preview.blockfrost.io/api/v0"
};

export interface AnchorPortOptions {
  mode?: string | undefined;
  store?: LedgerStore | undefined;
  /** Solo `real`. La key de Blockfrost, con el prefijo de red que le corresponde. */
  blockfrostApiKey?: string | undefined;
  /** Solo `real`. La seed de la wallet de servicio, que firma los anclajes. */
  seed?: string | undefined;
  /** Solo `real`. Default `Preprod` (D-013). */
  network?: string | undefined;
  /** Solo `real`. Para apuntar a un devnet; en Preprod sale de la red. */
  blockfrostUrl?: string | undefined;
}

function requerida(valor: string | undefined, nombre: string): string {
  const limpio = valor?.trim();
  if (!limpio) {
    // D-042: el modo inseguro no existe. Si falta configuración, esto tiene que
    // sonar al arrancar y no en el primer anclaje, con evidencia ya subida y
    // alguien esperando un TXID.
    throw new Error(`ANCHOR_MODE=real exige ${nombre}, y no está definida`);
  }
  return limpio;
}

/**
 * Construye el puerto desde la configuración.
 *
 * **Es async por `real` y no por gusto:** `LucidAnchorAdapter.create()` le
 * pregunta la dirección a la wallet para derivar el admin key hash, y eso es
 * I/O. Por eso el puerto se arma en el arranque del proceso —antes de escuchar,
 * como las migraciones— y no al importar un módulo: una seed inválida o un
 * Blockfrost caído tienen que impedir que la API levante, no romper el primer
 * anclaje (D-042).
 *
 * **Sin default inseguro:** ausente es `simulated`, el modo que no puede hacer
 * daño.
 */
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

  const network = (options.network ?? "Preprod") as RedPermitida;
  if (!REDES_PERMITIDAS.includes(network)) {
    throw new Error(
      `CARDANO_NETWORK="${network}" no está permitida. Valores posibles: ` +
        `${REDES_PERMITIDAS.join(" | ")}. Mainnet está fuera de alcance (D-013).`
    );
  }

  const apiKey = requerida(options.blockfrostApiKey, "BLOCKFROST_API_KEY");
  const seed = requerida(options.seed, "SERVICE_WALLET_SEED");
  const url = options.blockfrostUrl?.trim() || BLOCKFROST_URL[network];

  if (!url) {
    throw new Error(
      `No hay URL de Blockfrost para la red "${network}". Pasá blockfrostUrl explícita.`
    );
  }

  const lucid = await Lucid(new Blockfrost(url, apiKey), network as Network);
  lucid.selectWallet.fromSeed(seed);

  return LucidAnchorAdapter.create({ lucid, network: network as Network });
}
