import type { Network } from "@lucid-evolution/lucid";
import type { LedgerStore } from "./ledger";
import { ANCHOR_MODES, type AnchorMode, type AnchorPort } from "./port";
import type { LucidAnchorAdapter, ReferenceScriptPublication } from "./real";
import { SimulatedAnchorAdapter } from "./simulated";

// **`Lucid` y `./real` se cargan perezosos, solo dentro de `crearAdaptadorReal`
// (SPEC-411).** Medido: `@lucid-evolution/lucid` son 2s y 121MB de heap, 453
// módulos — y hasta este cambio, un `import` estático de módulo (no de rama)
// los cargaba en **todo** proceso que tocara este package, ancle o no: los 335
// tests de `apps/api`, `pnpm dev` en `simulated`, y el camino `disabled` —
// justo el que corre cuando la configuración de anclaje está rota. Los imports
// de arriba son `import type`: se borran en la compilación, cero costo de
// runtime, y siguen dando los tipos que este archivo necesita para anotar.

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
  /**
   * Solo `real`. La **clave de pago** de la wallet de servicio, en bech32
   * (`ed25519e_sk…`), que firma los anclajes.
   *
   * **Es una clave de pago y no una seed, a propósito** (D-078). Una seed BIP-39
   * deriva el árbol HD entero —todas las cuentas, todas las direcciones, la
   * clave de staking—; el servicio solo necesita firmar con una. Darle la seed
   * era más autoridad de la necesaria en una variable de entorno.
   *
   * Lucid solo deriva una dirección **enterprise** desde una clave de pago. El
   * *payment credential* es el mismo que el de la dirección base equivalente, y
   * ese hash es el admin del validador: por eso el cambio no mueve la dirección
   * del script ni deja inalcanzables los hilos ya anclados.
   */
  privateKey?: string | undefined;
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

/**
 * Construye el puerto desde la configuración.
 *
 * **Es async por `real` y no por gusto:** `LucidAnchorAdapter.create()` le
 * pregunta la dirección a la wallet para derivar el admin key hash, y eso es
 * I/O. Por eso el puerto se arma en el arranque del proceso —antes de escuchar,
 * como las migraciones— y no al importar un módulo: una clave inválida o un
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

  return crearAdaptadorReal(options);
}

/**
 * El adaptador real, ya cableado. Lo usa `createAnchorPort` y lo usa el script
 * que publica el reference script.
 *
 * **Devuelve la clase y no el puerto** porque publicar el reference script no es
 * una operación del puerto: gasta ADA de la wallet, se hace una vez por red y no
 * produce ningún anclaje. Meterla en `AnchorPort` obligaría al simulador a
 * fingir que la tiene.
 */
async function crearAdaptadorReal(options: AnchorPortOptions): Promise<LucidAnchorAdapter> {
  // Las cuatro validaciones de configuración corren ANTES del import
  // perezoso: un ANCHOR_MODE=real mal configurado (mainnet, secreto ausente)
  // tira sin haber pagado el costo de cargar Lucid (D-042 y SPEC-411 juntas —
  // el error sale en el mismo momento que hoy, no un paso después).
  const network = validarRed(options.network);
  const apiKey = requerida(options.blockfrostApiKey, "BLOCKFROST_API_KEY");
  const privateKey = requerida(options.privateKey, "SERVICE_WALLET_PRIVATE_KEY");
  const url = urlDeBlockfrost(options.blockfrostUrl, network);

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

/**
 * Publica el validador como reference script y devuelve **datos planos**.
 *
 * Es lo único que el script de operador necesita, y así ni el script ni nadie
 * fuera de este package toca una instancia de Lucid (D-014).
 */
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
