import type { LedgerStore } from "./ledger";
import { ANCHOR_MODES, type AnchorMode, type AnchorPort } from "./port";
import { SimulatedAnchorAdapter } from "./simulated";

/**
 * Construye el puerto desde la configuración.
 *
 * **Sin default inseguro** (D-042): el default es `simulated` —el modo que no
 * puede hacer daño— y `real` **revienta acá**, al arrancar, en vez de fallar en
 * el primer anclaje. Mientras la rebanada B no exista, pedir `real` es un error
 * de configuración y tiene que sonar como tal.
 */
export function createAnchorPort(options: {
  mode?: string | undefined;
  store?: LedgerStore | undefined;
}): AnchorPort {
  const mode = (options.mode ?? "simulated") as AnchorMode;

  if (!ANCHOR_MODES.includes(mode)) {
    throw new Error(
      `ANCHOR_MODE inválido: "${mode}". Valores posibles: ${ANCHOR_MODES.join(" | ")}`
    );
  }

  if (mode === "real") {
    throw new Error(
      "ANCHOR_MODE=real todavía no existe: el adaptador de Blockfrost llega en la rebanada B " +
        "de SPEC-013. Hasta entonces, ANCHOR_MODE=simulated."
    );
  }

  return new SimulatedAnchorAdapter(options.store ? { store: options.store } : {});
}
