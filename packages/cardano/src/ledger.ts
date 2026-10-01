import type { StageDatum } from "@plataforma/shared";
import type { OutputRef } from "./port";

export interface LedgerUtxo {
  outputRef: OutputRef;
  assetName: string;
  datum: StageDatum;
  spentByTxid: string | null;
}

export interface LedgerStore {
  get(outputRef: OutputRef): Promise<LedgerUtxo | undefined>;
  findLive(assetName: string): Promise<LedgerUtxo | undefined>;
  put(utxo: LedgerUtxo): Promise<void>;
  markSpent(outputRef: OutputRef, spentByTxid: string): Promise<void>;
  registrarBloque(txid: string, at: number): Promise<void>;
  bloqueDe(txid: string): Promise<number | undefined>;
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly utxos = new Map<OutputRef, LedgerUtxo>();
  private readonly bloques = new Map<string, number>();

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

  async registrarBloque(txid: string, at: number): Promise<void> {
    if (!this.bloques.has(txid)) this.bloques.set(txid, at);
  }

  async bloqueDe(txid: string): Promise<number | undefined> {
    return this.bloques.get(txid);
  }
}
