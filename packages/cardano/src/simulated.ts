import { createHash } from "node:crypto";
import type { StageDatum } from "@plataforma/shared";
import { canCompleteWithEvidence, canTransition, isValidInitialDatum } from "@plataforma/shared";
import { InMemoryLedgerStore, type LedgerStore } from "./ledger";
import {
  type AdvanceThreadInput,
  type AnchorPort,
  type AnchorProof,
  type AnchorReceipt,
  AnchorRejectedError,
  type CommitmentAnchorInput,
  type LiveThread,
  type MetadataAnchorReceipt,
  type OpenThreadInput,
  type OutputRef
} from "./port";

function ordenarPorClave([a]: [string, unknown], [b]: [string, unknown]): number {
  /* v8 ignore next -- @preserve: el único llamador es `Object.entries(...).sort(...)`, y las claves de un objeto son siempre distintas — `a === b` no puede pasar */
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    typeof v === "object" && v !== null && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(ordenarPorClave))
      : v
  );
}

function txidOf(kind: string, payload: unknown): string {
  return createHash("sha256")
    .update(`${kind}:${canonical(payload)}`)
    .digest("hex");
}

function reject(code: string, message: string): never {
  throw new AnchorRejectedError(message, code);
}

function identityPreserved(previous: StageDatum, next: StageDatum): boolean {
  return (
    next.projectRef === previous.projectRef &&
    next.stageRef === previous.stageRef &&
    next.sequenceOrder === previous.sequenceOrder &&
    next.validationCritical === previous.validationCritical
  );
}

export interface SimulatedAnchorOptions {
  store?: LedgerStore;
  now?: () => number;
}

export class SimulatedAnchorAdapter implements AnchorPort {
  readonly mode = "simulated" as const;
  readonly network = "Simulated" as const;

  private readonly store: LedgerStore;
  private readonly now: () => number;

  constructor(options: SimulatedAnchorOptions = {}) {
    this.store = options.store ?? new InMemoryLedgerStore();
    this.now = options.now ?? (() => Date.now());
  }

  async openThread({ datum }: OpenThreadInput): Promise<AnchorReceipt> {
    const vivo = await this.store.findLive(datum.stageRef);
    if (vivo) {
      reject("THREAD_ALREADY_OPEN", `El stage ${datum.stageRef} ya tiene un hilo abierto`);
    }

    if (!isValidInitialDatum(datum)) {
      reject("INVALID_INITIAL_DATUM", "El datum inicial no cumple las reglas del mint");
    }

    return this.commit(txidOf("mint", datum), datum);
  }

  async advanceThread({ outputRef, previous, next }: AdvanceThreadInput): Promise<AnchorReceipt> {
    const utxo = await this.store.get(outputRef);
    if (!utxo) {
      reject("UNKNOWN_THREAD", `No existe el UTxO ${outputRef}`);
    }
    if (utxo.spentByTxid !== null) {
      reject("THREAD_ALREADY_SPENT", `El UTxO ${outputRef} ya fue gastado`);
    }
    if (canonical(utxo.datum) !== canonical(previous)) {
      reject("STALE_DATUM", "El datum que se quiere gastar no es el que tiene el hilo");
    }
    if (!canTransition(previous.state, next.state)) {
      reject("INVALID_TRANSITION", `Transición inválida: ${previous.state} → ${next.state}`);
    }
    if (!identityPreserved(previous, next)) {
      reject("IDENTITY_REWRITTEN", "La identidad del stage no puede cambiar");
    }
    if (
      next.state === "Completed" &&
      !canCompleteWithEvidence(previous.validationCritical, next.evidenceRoot)
    ) {
      reject("EVIDENCE_REQUIRED", "Un stage validation-critical no se completa sin commitment");
    }

    const txid = txidOf("spend", { outputRef, next });
    await this.store.markSpent(outputRef, txid);
    return this.commit(txid, next);
  }

  async findLiveThread(stageRef: string): Promise<LiveThread | null> {
    const vivo = await this.store.findLive(stageRef);
    return vivo ? { outputRef: vivo.outputRef, datum: vivo.datum } : null;
  }

  async anchorCommitment({
    sha256,
    reference
  }: CommitmentAnchorInput): Promise<MetadataAnchorReceipt> {
    if (!/^[0-9a-f]{64}$/.test(sha256)) {
      reject("BAD_EVIDENCE_HASH", `No es un SHA-256 en hex: ${sha256}`);
    }
    const txid = txidOf("evidence", { sha256, reference });
    await this.registrar(txid);
    return { txid, status: "Pending" };
  }

  async verify(txid: string): Promise<AnchorProof | null> {
    const utxo = await this.store.get(`${txid}#0`);
    if (!utxo) return null;
    const blockTimestamp = await this.store.bloqueDe(txid);
    if (blockTimestamp === undefined) return null;
    return { txid, outputRef: utxo.outputRef, blockTimestamp, datum: utxo.datum };
  }

  async awaitConfirmation(txid: string): Promise<AnchorProof> {
    const proof = await this.verify(txid);
    if (!proof) reject("UNKNOWN_TXID", `No hay anclaje con txid ${txid}`);
    return proof;
  }

  async confirmedAt(txid: string): Promise<number | null> {
    return (await this.store.bloqueDe(txid)) ?? null;
  }

  private async registrar(txid: string): Promise<void> {
    await this.store.registrarBloque(txid, this.now());
  }

  private async commit(txid: string, datum: StageDatum): Promise<AnchorReceipt> {
    const outputRef: OutputRef = `${txid}#0`;
    await this.store.put({ outputRef, assetName: datum.stageRef, datum, spentByTxid: null });
    await this.registrar(txid);
    return { txid, outputRef, status: "Pending" };
  }
}
