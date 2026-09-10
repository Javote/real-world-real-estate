import {
  type AdvanceThreadInput,
  type AnchorPort,
  type AnchorProof,
  type AnchorReceipt,
  AnchorRejectedError,
  type CommitmentAnchorInput,
  type LiveThread,
  type MetadataAnchorReceipt,
  type OpenThreadInput
} from "./port";

// El puerto que no puede anclar y lo dice en cada llamada.
//
// **Por qué existe.** Hasta hoy, una configuración de anclaje mal puesta mataba
// el proceso al arrancar (D-042): sin `BLOCKFROST_API_KEY`, o con `simulated`
// contra una base remota, la API no levantaba. Eso convierte un problema de
// **una** función —anclar— en la caída de las otras cincuenta: login, listados,
// subida de evidencia, contratos. Un push con una variable mal puesta dejaba el
// producto entero abajo.
//
// La degradación ya estaba diseñada para el resto del ciclo de vida: SPEC-013
// §Invariante 2 dice que si el puerto tira una excepción, la declaración queda
// escrita y el evento queda `Failed`. Un puerto que **nace** roto no era parte
// de ese invariante; esto lo mete adentro. Ver D-075.
//
// **No es un modo permisivo.** Es el más estricto que existe: no produce ni un
// solo TXID, así que no puede afirmar ninguna prueba (regla 17, D-026). Un
// Blockfrost caído y una key ausente producen exactamente el mismo resultado
// visible —evento `Failed`, UI en "Pendiente"—, y eso está bien: una
// configuración rota no es peor que una caída del proveedor, y ninguna de las
// dos justifica apagar el producto.

/** El código que llevan todos los rechazos de este puerto. */
export const ANCHOR_DISABLED = "ANCHOR_DISABLED";

export class DisabledAnchorAdapter implements AnchorPort {
  readonly mode = "disabled" as const;
  /** No produce ningún TXID, así que no hay red que declarar. */
  readonly network = null;

  /**
   * @param reason Por qué quedó inhabilitado, en texto. Va al log de arranque y
   * a cada rechazo, porque el operador que ve un evento `Failed` en la UI tiene
   * que poder llegar a la causa sin leer el arranque de hace tres días.
   */
  constructor(readonly reason: string) {}

  /**
   * **Cada método es `async` y esto se llama adentro**, para que el rechazo sea
   * una promesa rechazada y no una excepción síncrona. Los call sites de hoy
   * hacen `await port.x()` dentro de un `try`, así que las dos formas se
   * atrapan igual; el que guarde la promesa antes de esperarla solo sobrevive a
   * esta.
   */
  private rechazar(): never {
    throw new AnchorRejectedError(`El anclaje está inhabilitado: ${this.reason}`, ANCHOR_DISABLED);
  }

  async openThread(_input: OpenThreadInput): Promise<AnchorReceipt> {
    this.rechazar();
  }

  async advanceThread(_input: AdvanceThreadInput): Promise<AnchorReceipt> {
    this.rechazar();
  }

  async anchorCommitment(_input: CommitmentAnchorInput): Promise<MetadataAnchorReceipt> {
    this.rechazar();
  }

  /** Mismo criterio que `verify()`: rechaza, no dice `null` — no consultó nada. */
  async findLiveThread(_stageRef: string): Promise<LiveThread | null> {
    this.rechazar();
  }

  /**
   * También rechaza, y no devuelve `null`.
   *
   * `null` significa "consulté y todavía no confirmó", que es una afirmación
   * sobre la cadena. Este puerto no consultó nada. La diferencia importa en
   * `reconcile()`: con `null` la tanda seguiría en silencio como si todo
   * estuviera bien; con excepción, el `catch` la saltea y el error queda en el
   * log.
   */
  async verify(_txid: string): Promise<AnchorProof | null> {
    this.rechazar();
  }

  async awaitConfirmation(_txid: string): Promise<AnchorProof> {
    this.rechazar();
  }

  async confirmedAt(_txid: string): Promise<number | null> {
    this.rechazar();
  }
}
