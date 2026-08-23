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
  type OpenThreadInput,
  type OutputRef
} from "./port";

// Adaptador simulado. Aplica **las mismas reglas que
// `contracts/validators/stage.ak`**, sin red y sin claves:
//
//   mint   → un solo hilo vivo por stage · datum inicial legítimo
//   spend  → el UTxO existe y está sin gastar · transición válida ·
//            identidad preservada · evidencia en stages críticos
//
// Un simulador que dice que sí a todo no simula: miente, y encima da confianza.
// Este rechaza lo mismo que rechazaría la cadena, así que el bug se descubre en
// un test y no en una transacción firmada y pagada.
//
// El TXID es **determinístico**: `sha256` del payload canónico. Anclar dos
// veces lo mismo da el mismo TXID, que es la forma barata de ver una doble
// escritura en los tests.

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    typeof v === "object" && v !== null && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort())
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

/** Espeja `identity_preserved` del validador. */
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
  /** Reloj inyectable: los tests no dependen de la hora de la máquina. */
  now?: () => number;
}

export class SimulatedAnchorAdapter implements AnchorPort {
  readonly mode = "simulated" as const;

  private readonly store: LedgerStore;
  private readonly now: () => number;
  private readonly proofs = new Map<string, AnchorProof>();

  constructor(options: SimulatedAnchorOptions = {}) {
    this.store = options.store ?? new InMemoryLedgerStore();
    this.now = options.now ?? (() => Date.now());
  }

  async openThread({ datum }: OpenThreadInput): Promise<AnchorReceipt> {
    // El thread token: exactamente uno por stage, y no se puede quemar (D-058).
    // Si ya hay un UTxO vivo para este stage, abrir otro sería el hilo paralelo
    // que el NFT existe para impedir.
    const vivo = await this.store.findLive(datum.stageRef);
    if (vivo) {
      reject("THREAD_ALREADY_OPEN", `El stage ${datum.stageRef} ya tiene un hilo abierto`);
    }

    // Espeja `valid_initial_datum`: Pending, sin evidencia, sin fecha.
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
      // Doble gasto: en la cadena real, la segunda transacción no entra.
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

  async verify(txid: string): Promise<AnchorProof | null> {
    return this.proofs.get(txid) ?? null;
  }

  /** En el simulador la confirmación es inmediata: el hueco entre declarar y
   * confirmar se ejercita con el adaptador real (rebanada B). */
  async awaitConfirmation(txid: string): Promise<AnchorProof> {
    const proof = await this.verify(txid);
    if (!proof) reject("UNKNOWN_TXID", `No hay anclaje con txid ${txid}`);
    return proof;
  }

  private async commit(txid: string, datum: StageDatum): Promise<AnchorReceipt> {
    const outputRef: OutputRef = `${txid}#0`;
    await this.store.put({ outputRef, assetName: datum.stageRef, datum, spentByTxid: null });
    this.proofs.set(txid, { txid, outputRef, blockTimestamp: this.now(), datum });
    return { txid, outputRef, status: "Confirmed" };
  }
}
