import type { StageDatum } from "@plataforma/shared";

// `AnchorPort` — la cadena detrás de una interfaz propia (D-014, principio 7).
//
// **Nada fuera de este package importa Lucid ni Blockfrost.** La API llama al
// puerto y no sabe que Cardano existe; el adaptador real llega en la rebanada B
// de SPEC-013 sin que la API cambie una línea.
//
// Las dos operaciones espejan los dos handlers del validador
// (`contracts/validators/stage.ak`): `openThread` es `mint` —acuñar el thread
// token y crear el hilo— y `advanceThread` es `spend` —gastarlo y recrearlo—.
// D-014 los llamaba `anchor()` a los dos; se abren porque tienen precondiciones
// distintas: uno exige que NO exista hilo, el otro que exista y esté sin gastar.

export const ANCHOR_MODES = ["simulated", "real"] as const;
export type AnchorMode = (typeof ANCHOR_MODES)[number];

/** Un UTxO, en la forma en que se persiste: `txid#index`. */
export type OutputRef = string;

export type AnchorStatus = "Pending" | "Confirmed";

export interface AnchorReceipt {
  txid: string;
  /**
   * El hilo que **queda vivo** después de la operación. Es estado crítico: si
   * se pierde, el thread token queda en un UTxO que nadie sabe cuál es y ese
   * stage no se puede volver a mover nunca.
   */
  outputRef: OutputRef;
  status: AnchorStatus;
}

export interface AnchorProof {
  txid: string;
  outputRef: OutputRef;
  /** POSIX ms del bloque. En el simulador, el momento del anclaje. */
  blockTimestamp: number;
  datum: StageDatum;
}

export interface OpenThreadInput {
  datum: StageDatum;
}

export interface AdvanceThreadInput {
  outputRef: OutputRef;
  previous: StageDatum;
  next: StageDatum;
}

/**
 * El **otro** camino on-chain de M1: `Evidence Anchor Transactions`
 * (`M1-D2/1-system-architecture.puml`), que es metadata suelta y no pasa por
 * ningún validador (D-006).
 *
 * Prueba una cosa distinta a la del hilo: *este archivo existía a esta hora*.
 * El hilo prueba *este stage se completó con esta evidencia y en este orden*.
 * Ninguno reemplaza al otro (D-061).
 */
export interface EvidenceAnchorInput {
  /** SHA-256 del archivo, en hex. Es lo único que viaja: nunca el archivo, ni
   * su nombre, ni quién lo subió (regla 2). */
  sha256: string;
  /** Ref opaca al registro off-chain, para poder encontrarlo después. */
  reference: string;
}

export interface MetadataAnchorReceipt {
  txid: string;
  status: AnchorStatus;
}

/** Label CIP-20 del anclaje de evidencia (D-006). */
export const EVIDENCE_METADATA_LABEL = 1904;

export interface AnchorPort {
  readonly mode: AnchorMode;
  openThread(input: OpenThreadInput): Promise<AnchorReceipt>;
  advanceThread(input: AdvanceThreadInput): Promise<AnchorReceipt>;
  /** Ancla el hash de un archivo por metadata. Lo dispara el admin, nunca el
   * upload (D-061). */
  anchorEvidence(input: EvidenceAnchorInput): Promise<MetadataAnchorReceipt>;
  verify(txid: string): Promise<AnchorProof | null>;
  awaitConfirmation(txid: string): Promise<AnchorProof>;
}

/**
 * Rechazo del puerto por una regla que el validador también aplicaría. Se
 * distingue de un error de infraestructura a propósito: esto NO se reintenta,
 * porque reintentarlo daría el mismo rechazo.
 */
export class AnchorRejectedError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "AnchorRejectedError";
  }
}
