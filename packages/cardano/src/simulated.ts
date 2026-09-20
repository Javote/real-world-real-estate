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
//
// **El recibo dice `Pending`, igual que el adaptador real** (D-087, la
// "Defensa 3" que quedaba pendiente de D-079/D-080: antes decía `Confirmed`
// directo, y esa era la única diferencia de contrato entre los dos
// adaptadores — quien escribía código contra el simulador podía confiar en
// que un anclaje se resuelve en el mismo request, y eso es falso contra
// Preprod). Que el simulador **conozca** el txid al toque
// —`confirmedAt`/`verify` lo encuentran de inmediato, sin esperar nada— sigue
// siendo cierto y es lo que lo hace barato para tests: la diferencia es que
// ahora nadie se entera sin preguntar. `Confirmed` sale siempre de ese
// chequeo aparte (`anchorEvent` en la API, o un `reconcile`), nunca del
// recibo.

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
  /** Su propia cadena, y solo habla de ella: sus TXID resuelven contra `SimulatedLedgerUtxo`. */
  readonly network = "Simulated" as const;

  private readonly store: LedgerStore;
  private readonly now: () => number;

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

  /** `LedgerStore.findLive` ya busca por `stageRef` — es la misma pregunta. */
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
    // Determinístico como el resto del simulador: anclar dos veces el mismo
    // archivo da el mismo txid, que es como se ve una doble escritura.
    const txid = txidOf("evidence", { sha256, reference });
    await this.registrar(txid);
    return { txid, status: "Pending" };
  }

  /**
   * Rehecho desde el store (SPEC-406) en vez de un `Map` propio: el UTxO que
   * `commit()` dejó vivo o gastado ya tiene el `datum`, y su `outputRef` es
   * siempre `${txid}#0` — no hace falta persistir el proof aparte, solo
   * reconstruirlo. Un anclaje por metadata no dejó UTxO nunca: sigue dando
   * `null`, igual que antes.
   */
  async verify(txid: string): Promise<AnchorProof | null> {
    const utxo = await this.store.get(`${txid}#0`);
    if (!utxo) return null;
    const blockTimestamp = await this.store.bloqueDe(txid);
    if (blockTimestamp === undefined) return null;
    return { txid, outputRef: utxo.outputRef, blockTimestamp, datum: utxo.datum };
  }

  /** El registro (`bloques`/`proofs`) queda listo desde el `commit`, así que
   * esto encuentra algo de inmediato — pero solo si alguien lo pregunta. */
  async awaitConfirmation(txid: string): Promise<AnchorProof> {
    const proof = await this.verify(txid);
    if (!proof) reject("UNKNOWN_TXID", `No hay anclaje con txid ${txid}`);
    return proof;
  }

  /**
   * ¿Está esta transacción en la cadena de este simulador?
   *
   * **Antes devolvía `this.now()` para cualquier txid**, incluidos los que nunca
   * produjo: afirmaba confirmación sobre transacciones que no conocía. Era el
   * único lugar del código que confundía *tengo un hash* con *está confirmada*,
   * y esas son dos cosas distintas incluso en Cardano de verdad — el txid es el
   * hash del cuerpo de la transacción y existe antes de enviarla.
   *
   * Ahora contesta desde su propio registro, que es la misma pregunta que el
   * adaptador real le hace a Blockfrost. Un txid ajeno da `null`.
   *
   * No se delega en `verify()`: eso devuelve un `AnchorProof`, que exige
   * `outputRef` y `datum` —cosas de un anclaje **con hilo**—, así que un anclaje
   * por metadata daría `null` aunque el simulador lo haya producido.
   *
   * **Pasa por el `store` (SPEC-406)**, no por un `Map` de la instancia: así
   * sobrevive a un reinicio del proceso, igual que los UTxOs.
   */
  async confirmedAt(txid: string): Promise<number | null> {
    return (await this.store.bloqueDe(txid)) ?? null;
  }

  /**
   * Anota el txid como incluido. **No pisa el timestamp si ya estaba**: el
   * simulador es determinístico, así que anclar dos veces el mismo archivo
   * devuelve el mismo txid, y el momento en que entró a la cadena no se mueve
   * porque alguien vuelva a intentarlo. La idempotencia la garantiza el store.
   */
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
