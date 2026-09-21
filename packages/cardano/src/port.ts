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

/**
 * Lo que el puerto **efectivamente puede ejercer**, que no es lo mismo que lo
 * que se pidió por configuración.
 *
 * `"disabled"` no es un valor válido de `ANCHOR_MODE` —por eso no está en
 * `ANCHOR_MODES`—: no se elige, se cae en él cuando el puerto no se pudo
 * construir (D-075). Un puerto inhabilitado no puede decir que es `simulated`
 * ni `real` sin mentir, y el log de arranque es justamente donde esa mentira
 * costaría más.
 */
export type PortMode = AnchorMode | "disabled";

/**
 * **Contra qué ledger resuelve un TXID.** Es lo que D-080 pide guardar por
 * evento: un TXID sin red es inverificable en cuanto exista más de una, y
 * mainnet es inminente.
 *
 * `"Simulated"` está en la lista y **no es el adaptador disfrazado.** D-080
 * rechazó una columna `anchorMode` porque a la tabla no le importa qué
 * adaptador corrió; esto es otra cosa: un TXID del simulador resuelve contra
 * `SimulatedLedgerUtxo`, que es una tabla que existe. El simulador es su propia
 * cadena y solo habla de ella. Que correlacione con el adaptador es incidental,
 * no es lo que se guarda.
 */
export const ANCHOR_NETWORKS = ["Mainnet", "Preprod", "Preview", "Custom", "Simulated"] as const;
export type AnchorNetwork = (typeof ANCHOR_NETWORKS)[number];

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
  /**
   * POSIX ms del bloque, o `null` sin fuente para saberlo (SPEC-409) — contra
   * el `Emulator`/devnet, sin Blockfrost configurado. **Nunca el reloj del
   * proceso**: eso es el momento en que alguien preguntó, no el del bloque.
   * En el simulador, el momento de inclusión en su propia cadena, que para
   * él es autoritativo y por eso nunca es `null`.
   */
  blockTimestamp: number | null;
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
 * El UTxO vivo del hilo de un stage, leído **directo de la cadena** — no del
 * registro de eventos, que es justo lo que puede estar desincronizado
 * (Capa 1 de `specs/evidencia-m3/3-preprod/REPORTE-2026-09-10-prueba-de-volumen.md`, el caso real
 * que la motivó: un `OnChainEvent` sin `txid` mientras el UTxO seguía vivo).
 */
export interface LiveThread {
  outputRef: OutputRef;
  datum: StageDatum;
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
export interface CommitmentAnchorInput {
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
  readonly mode: PortMode;
  /**
   * La red de los TXID que este puerto produce, o `null` si no produce
   * ninguno (`disabled`).
   *
   * **Sale del puerto y no de `process.env`** a propósito: la variable de
   * entorno es lo que se *pidió*, y el puerto es lo que efectivamente se
   * construyó. Leer el env al insertar la fila las dejaría desincronizarse en
   * silencio, que es justo lo que la columna existe para impedir.
   */
  readonly network: AnchorNetwork | null;
  openThread(input: OpenThreadInput): Promise<AnchorReceipt>;
  advanceThread(input: AdvanceThreadInput): Promise<AnchorReceipt>;
  /**
   * ¿Existe hoy un UTxO vivo para este hilo, y qué datum tiene? Busca por
   * `stageRef` (el asset name del thread token, D-058) directo contra el
   * ledger — nunca contra `OnChainEvent`, que es el registro que este método
   * existe para poder corregir sin confiar en sí mismo.
   *
   * `null` es ambiguo a propósito en dos casos que a este método no le
   * corresponde distinguir: el stage nunca minteó, o el proveedor todavía no
   * indexó una transacción reciente. Quien llama decide qué hacer con eso —
   * acá, `hilosSospechosos`/reconciliación (Capa 1), nunca escribe sobre un
   * `null`.
   */
  findLiveThread(stageRef: string): Promise<LiveThread | null>;
  /**
   * Ancla un commitment por metadata: el hash de un archivo (D-061), la
   * aceptación de una invitación, una liberación, una firma de notario. Todo lo
   * que M2-D5 anota con "(→ TXID)" y no mueve el hilo de un stage.
   *
   * Para evidencia lo dispara el admin, nunca el upload.
   */
  anchorCommitment(input: CommitmentAnchorInput): Promise<MetadataAnchorReceipt>;
  verify(txid: string): Promise<AnchorProof | null>;
  awaitConfirmation(txid: string): Promise<AnchorProof>;
  /**
   * ¿Está esta transacción en la cadena? Devuelve el **POSIX ms del bloque**, o
   * `null` si todavía no confirmó.
   *
   * **Existe porque `verify()` no sirve para esto.** `verify()` devuelve un
   * `AnchorProof`, que exige `outputRef` y `datum`: los tiene un anclaje **con
   * hilo**, y no los tiene uno por metadata —el de la evidencia—. Preguntarle a
   * `verify()` por un anclaje de metadata da `null`, que es indistinguible de
   * "no confirmó" para una transacción que sí está en la cadena.
   *
   * Es lo mínimo que hace falta para promover `Pending` → `Confirmed`
   * (SPEC-013 §C, `reconcile()` en lectura).
   */
  confirmedAt(txid: string): Promise<number | null>;
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
