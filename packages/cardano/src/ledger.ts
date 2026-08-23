import type { StageDatum } from "@plataforma/shared";
import type { OutputRef } from "./port";

// El ledger del simulador.
//
// **El simulador es producto, no un stub** (principio 7, D-014): tiene que
// detectar doble gasto y hilos duplicados igual que la cadena, o no simula
// nada. Para eso necesita estado, y el estado necesita dónde vivir.
//
// La interfaz existe para que ese "dónde" sea del consumidor: en los tests es
// memoria, y en `apps/api` es SQLite (tabla `SimulatedLedgerUtxo`), así que
// reiniciar `pnpm dev` no pierde los hilos abiertos.

export interface LedgerUtxo {
  outputRef: OutputRef;
  /** Asset name del thread token = `stageRef` del datum. */
  assetName: string;
  datum: StageDatum;
  spentByTxid: string | null;
}

export interface LedgerStore {
  get(outputRef: OutputRef): Promise<LedgerUtxo | undefined>;
  /** El UTxO vivo (sin gastar) de un hilo, si existe. */
  findLive(assetName: string): Promise<LedgerUtxo | undefined>;
  put(utxo: LedgerUtxo): Promise<void>;
  markSpent(outputRef: OutputRef, spentByTxid: string): Promise<void>;
}

/** Ledger de memoria: el de los tests y el de cualquier proceso efímero. */
export class InMemoryLedgerStore implements LedgerStore {
  private readonly utxos = new Map<OutputRef, LedgerUtxo>();

  async get(outputRef: OutputRef): Promise<LedgerUtxo | undefined> {
    return this.utxos.get(outputRef);
  }

  async findLive(assetName: string): Promise<LedgerUtxo | undefined> {
    for (const utxo of this.utxos.values()) {
      if (utxo.assetName === assetName && utxo.spentByTxid === null) return utxo;
    }
    return undefined;
  }

  async put(utxo: LedgerUtxo): Promise<void> {
    this.utxos.set(utxo.outputRef, utxo);
  }

  async markSpent(outputRef: OutputRef, spentByTxid: string): Promise<void> {
    const utxo = this.utxos.get(outputRef);
    if (utxo) this.utxos.set(outputRef, { ...utxo, spentByTxid });
  }
}
