import {
  type LucidEvolution,
  mintingPolicyToId,
  type Network,
  paymentCredentialOf,
  type TxBuilder,
  type UTxO
} from "@lucid-evolution/lucid";
import type { StageDatum } from "@plataforma/shared";
import { type Blueprint, loadBlueprint, type StageScriptRefs, stageScriptRefs } from "./blueprint";
import {
  decodeStageDatum,
  encodeAdvanceRedeemer,
  encodeInitRedeemer,
  encodeStageDatum
} from "./codec";
import {
  type AdvanceThreadInput,
  type AnchorNetwork,
  type AnchorPort,
  type AnchorProof,
  type AnchorReceipt,
  AnchorRejectedError,
  type CommitmentAnchorInput,
  EVIDENCE_METADATA_LABEL,
  type LiveThread,
  type MetadataAnchorReceipt,
  type OpenThreadInput,
  type OutputRef
} from "./port";

// El adaptador que construye transacciones de verdad (SPEC-013 §B).
//
// **Es agnóstico del provider a propósito.** Recibe una instancia de Lucid ya
// configurada, así que el mismo código corre contra el `Emulator` (en proceso,
// en CI), contra yaci-devkit (nodo local) y contra Preprod. Si hiciera falta
// cambiar una línea al pasar de uno a otro, lo probado en CI no sería lo que
// corre en producción.
//
// El `admin` no se configura: **se deriva de la wallet** que tiene la instancia.
// Configurarlo aparte permitiría que la firma y la dirección del script se
// desincronicen, y el síntoma sería hablarle a una dirección donde no hay
// ningún hilo — sin error, solo silencio.

/** ADA mínimo que queda bloqueado con el thread token. No es valor: es el
 * mínimo que Cardano exige para que un UTxO exista (D-021). */
export const THREAD_MIN_LOVELACE = 2_000_000n;

/**
 * Ventana de validez de la transacción. El validador exige las dos puntas
 * finitas y que `completed_at` caiga adentro (`within_validity_range`).
 *
 * **Tres minutos, y el número tiene razón:** el nodo solo sabe traducir slots a
 * tiempo dentro de su *horizonte* —el safe zone de la era—, y una ventana más
 * larga que eso hace fallar la evaluación con `PastHorizon: transaction's
 * validity bounds go beyond the foreseeable end of the current era`. En un
 * devnet con epochs de 600 slots el safe zone son 300 segundos, así que 10
 * minutos no entran. Tres sí, en cualquier red.
 */
export const VALIDITY_WINDOW_MS = 3 * 60 * 1000;

/**
 * Cuánto se corre hacia atrás el borde inferior de la ventana, para absorber
 * el retraso del tip.
 *
 * **El nodo NO valida contra su reloj: valida contra el slot del último
 * bloque.** Una transacción con `validFrom = ahora` se rechaza con
 * `OutsideValidityIntervalUTxO` siempre que el último bloque tenga más de un
 * segundo, que en una red real es casi siempre. Medido contra Preprod el
 * 2026-08-31: la tx declaraba `invalidBefore = 132536176`, el nodo validó en
 * `132536159` y el tip era el bloque 5123377 en el slot `132536158` — el nodo
 * estaba exactamente en `tip + 1`.
 *
 * **Por qué no se vio antes:** el `Emulator` mueve los slots con su propio
 * reloj y yaci-devkit hace bloques de ~1 s, así que el retraso no existe en
 * ninguno de los dos. El camino de metadata —el único que había corrido contra
 * Preprod— no declara ventana de validez.
 *
 * **Dos minutos, y el número es un compromiso explícito.** Los huecos entre
 * bloques son exponenciales con media 20 s (`activeSlotCoeff = 0.05`), así que
 * 120 s cubre el 99,75 % de los casos; el 0,25 % restante deja el evento en
 * `Failed` y se reintenta. El costo del otro lado es real y hay que decirlo:
 * la ventana es lo que le acota al operador el `completed_at` que puede
 * escribir (`within_validity_range`), así que ensancharla hacia atrás le da
 * 120 s de margen para antedatar una finalización. El timestamp del bloque
 * sigue siendo una cota pública y mucho más ajustada.
 *
 * No se consulta el tip al proveedor a propósito: este adaptador es agnóstico
 * del provider —corre igual contra el `Emulator`, contra yaci y contra
 * Preprod— y pedir `/blocks/latest` lo ataría a Blockfrost.
 */
export const TIP_LAG_MARGIN_MS = 2 * 60 * 1000;

/**
 * Cuánto dura la vista local de lo que este proceso ya envió y la cadena
 * todavía no indexó.
 *
 * **El problema que resuelve.** La wallet de servicio tiene un solo UTxO
 * grande. `getUtxos()` le pregunta al proveedor, y el proveedor solo conoce lo
 * que entró en un bloque —~20 s en Preprod—, así que dos anclajes seguidos
 * eligen la misma entrada: el segundo se arma contra un UTxO ya gastado y
 * muere en `Your wallet does not have enough funds`. Lo mismo del otro lado
 * con el hilo: `advanceThread` no encuentra el UTxO que `openThread` acaba de
 * crear (`UNKNOWN_THREAD`).
 *
 * **Tres minutos, y el número es una cota superior, no un tuning.** La cola
 * serializa los anclajes, así que la vista local solo tiene que cubrir el hueco
 * entre uno y el siguiente; si el siguiente llega más tarde que esto, el
 * proveedor ya indexó todo y la respuesta buena es preguntarle a él. Vencerla
 * es lo único que devuelve al adaptador a la realidad después de una
 * transacción que el nodo terminó descartando —y es también lo que hace que
 * fondear la wallet se vea— así que corta y no larga.
 */
export const PENDING_UTXO_TTL_MS = 3 * 60 * 1000;

/**
 * Cuánto espera `confirmedAt()` a que Blockfrost conteste (SPEC-410). Es un
 * GET a un único endpoint, no una consulta pesada — 10s es margen generoso
 * sobre una latencia normal y corto contra un servidor que aceptó la conexión
 * y no va a contestar nunca.
 */
export const BLOCKFROST_TIMEOUT_MS = 10 * 1000;

/** Lo que deja publicar el validador como reference script. */
export interface ReferenceScriptPublication {
  /** El UTxO que lleva el validador adentro. */
  outputRef: OutputRef;
  /** La transacción que lo creó, o `null` si ya estaba publicado. */
  txid: string | null;
  /** El ADA que queda inmovilizado ahí. No es valor: es el mínimo del UTxO. */
  lovelace: bigint;
}

export interface LucidAnchorOptions {
  lucid: LucidEvolution;
  network: Network;
  blueprint?: Blueprint;
  /** Ancho de la ventana de validez. Ver `VALIDITY_WINDOW_MS`. */
  validityWindowMs?: number;
  /** Margen hacia atrás por el retraso del tip. Ver `TIP_LAG_MARGIN_MS`. */
  tipLagMarginMs?: number;
  /** Vida de la vista local de lo enviado. Ver `PENDING_UTXO_TTL_MS`. */
  pendingUtxoTtlMs?: number;
  /** Reloj inyectable: los tests fijan el tiempo, no lo padecen. */
  now?: () => number;
  /**
   * Para `confirmedAt()`. Opcional a propósito: contra el `Emulator` y contra
   * el devnet no hay Blockfrost, y ahí `confirmedAt()` devuelve `null` —lo que
   * es honesto, no roto: sin fuente no se afirma que algo confirmó.
   */
  blockfrost?: { url: string; apiKey: string };
}

export class LucidAnchorAdapter implements AnchorPort {
  readonly mode = "real" as const;

  /**
   * La red contra la que este adaptador ancla. Ya la recibía para derivar la
   * dirección del script; ahora además se expone, porque es lo que se persiste
   * por evento (D-080).
   */
  readonly network: AnchorNetwork;

  /**
   * La dirección de la wallet de servicio — **la que hay que fondear**.
   *
   * Se expone para que el arranque la escriba en el log. Sin eso, "el anclaje
   * falla" y "la wallet está vacía" son el mismo síntoma, y hay que ir a buscar
   * la dirección a mano para distinguirlos.
   */
  readonly walletAddress: string;

  private readonly lucid: LucidEvolution;
  private readonly refs: StageScriptRefs;
  private readonly now: () => number;

  private readonly validityWindowMs: number;
  private readonly tipLagMarginMs: number;
  private readonly pendingUtxoTtlMs: number;
  private readonly blockfrost: { url: string; apiKey: string } | undefined;

  /**
   * La cola: **un anclaje por vez en este proceso**.
   *
   * Serializar es la mitad de la solución y no sirve sola —dos anclajes en
   * serie contra el proveedor eligen igual el mismo UTxO—, pero es la mitad sin
   * la cual la otra no existe: armar la transacción **lee** el conjunto de
   * UTxOs y enviarla lo **invalida**, así que las dos cosas tienen que pasar
   * sin nadie en el medio. Con dos anclajes concurrentes no hay orden de
   * `overrideUTxOs()` que alcance: los dos leyeron antes de que ninguno
   * escribiera.
   *
   * **Vale para un proceso, y hoy hay uno** (Render, plan free). Con dos
   * instancias esto no alcanza y el arreglo es de otra clase —el estado
   * compartido tendría que salir de la memoria—, así que se dice acá en vez de
   * descubrirse el día que se escale.
   */
  private cola: Promise<unknown> = Promise.resolve();

  /**
   * Las salidas al script que este proceso creó y el proveedor todavía no ve,
   * por `outputRef`. Es lo que le deja a `advanceThread` encontrar el hilo que
   * `openThread` abrió hace diez segundos.
   */
  private readonly salidasPendientes = new Map<OutputRef, UTxO>();

  /** Cuándo deja de valer la vista local. `null` = no hay nada en vuelo. */
  private venceLaVistaLocal: number | null = null;

  /**
   * El UTxO que lleva el validador publicado, si existe. Se descubre en
   * `create()` — no se configura, por el mismo motivo por el que la dirección
   * del script tampoco: una variable con un `txid#index` se puede desincronizar
   * del blueprint, y el síntoma sería una transacción que referencia un script
   * que no es el nuestro.
   *
   * `null` es un estado legítimo: sin él, cada transacción adjunta el validador
   * entero. Es lo que hacía siempre hasta el 2026-09-01.
   */
  private referenceUtxo: UTxO | null;

  private constructor(
    lucid: LucidEvolution,
    refs: StageScriptRefs,
    walletAddress: string,
    network: AnchorNetwork,
    now: () => number,
    validityWindowMs: number,
    tipLagMarginMs: number,
    pendingUtxoTtlMs: number,
    blockfrost: { url: string; apiKey: string } | undefined,
    referenceUtxo: UTxO | null
  ) {
    this.lucid = lucid;
    this.network = network;
    this.refs = refs;
    this.walletAddress = walletAddress;
    this.now = now;
    this.validityWindowMs = validityWindowMs;
    this.tipLagMarginMs = tipLagMarginMs;
    this.pendingUtxoTtlMs = pendingUtxoTtlMs;
    this.blockfrost = blockfrost;
    this.referenceUtxo = referenceUtxo;
  }

  /** La dirección del script, derivada del blueprint con el admin aplicado. */
  get address(): string {
    return this.refs.address;
  }

  /** La policy del thread token, que es el hash del propio script. */
  get policyId(): string {
    return this.refs.policyId;
  }

  static async create(options: LucidAnchorOptions): Promise<LucidAnchorAdapter> {
    const walletAddress = await options.lucid.wallet().address();
    const adminKeyHash = paymentCredentialOf(walletAddress).hash;
    const refs = stageScriptRefs(
      adminKeyHash,
      options.network,
      options.blueprint ?? loadBlueprint()
    );

    // Una consulta al arrancar, y con eso todas las transacciones de este
    // proceso dejan de cargar el validador. Si se publica el reference script
    // con la API arriba, la toma en el próximo reinicio.
    const referenceUtxo = await buscarReferenceScript(options.lucid, walletAddress, refs.policyId);

    return new LucidAnchorAdapter(
      options.lucid,
      refs,
      walletAddress,
      options.network,
      options.now ?? (() => Date.now()),
      options.validityWindowMs ?? VALIDITY_WINDOW_MS,
      options.tipLagMarginMs ?? TIP_LAG_MARGIN_MS,
      options.pendingUtxoTtlMs ?? PENDING_UTXO_TTL_MS,
      options.blockfrost,
      referenceUtxo
    );
  }

  /** `mint`: acuña el thread token y crea el hilo en `Pending`. */
  async openThread({ datum }: OpenThreadInput): Promise<AnchorReceipt> {
    const unit = this.unitOf(datum);

    return this.enCola(() =>
      this.enviar(
        this.conElValidador(
          this.lucid
            .newTx()
            .mintAssets({ [unit]: 1n }, encodeInitRedeemer())
            .pay.ToContract(
              this.refs.address,
              { kind: "inline", value: encodeStageDatum(datum) },
              { lovelace: THREAD_MIN_LOVELACE, [unit]: 1n }
            )
            .addSignerKey(this.adminKeyHash())
        )
      )
    );
  }

  /** `spend`: gasta el hilo y lo recrea con el datum nuevo. */
  async advanceThread(input: AdvanceThreadInput): Promise<AnchorReceipt> {
    return this.enCola(() => this.avanzar(input));
  }

  /**
   * Busca el UTxO vivo del hilo directo contra el proveedor — no contra
   * `salidasPendientes` (esa vista es de transacciones que esta misma
   * instancia acaba de mandar, y lo que se perdió lo mandó otra instancia o
   * un proceso que después crasheó, como el caso real que esto resuelve) ni
   * contra `enCola`/`utxoAt` (esos asumen que ya se sabe el `outputRef`; acá
   * es al revés, no se sabe y hay que encontrarlo por asset).
   */
  async findLiveThread(stageRef: string): Promise<LiveThread | null> {
    const unit = `${this.refs.policyId}${stageRef}`;
    const utxos = await this.lucid.utxosAt(this.refs.address);
    const vivo = utxos.find((u) => (u.assets[unit] ?? 0n) > 0n);
    if (!vivo?.datum) return null;
    return {
      outputRef: `${vivo.txHash}#${vivo.outputIndex}`,
      datum: decodeStageDatum(vivo.datum)
    };
  }

  private async avanzar({ outputRef, next }: AdvanceThreadInput): Promise<AnchorReceipt> {
    // El `previous` del puerto acá no se usa: el datum viejo lo trae el propio
    // UTxO, y el validador lo lee de ahí. Sirve en el simulador, que no tiene
    // cadena de dónde leerlo.
    const utxo = await this.utxoAt(outputRef);
    const now = this.now();

    const completion =
      next.state === "Completed"
        ? { evidenceRoot: next.evidenceRoot, now: next.completedAt }
        : null;

    // La ventana tiene que CONTENER el `completed_at` del datum, porque eso es
    // lo que el validador verifica (`within_validity_range`). Si el timestamp
    // cae afuera, la transacción se construye y se firma igual — y se rechaza.
    // `- tipLagMarginMs` y no `- 1000`: el nodo valida contra el slot del
    // último bloque, no contra su reloj. Ver `TIP_LAG_MARGIN_MS`.
    //
    // El borde no puede caer antes del **slot 0 de esta cadena**, y eso hay que
    // preguntárselo a Lucid: cada red pone su origen en otro lado. En Preprod
    // nunca entra, pero el `Emulator` arranca su slot 0 en el instante en que se
    // construye, así que restarle dos minutos lo manda a un slot negativo — que
    // Lucid serializa como entero sin signo y el nodo lee como
    // `18446744073709552000`. No es una fecha rara: es un desbordamiento.
    const origen = this.lucid.slotToUnixTime(0);
    const desde = Math.max(
      origen,
      (completion ? Math.min(now, completion.now) : now) - this.tipLagMarginMs
    );
    const hasta = Math.max(now, completion?.now ?? now) + this.validityWindowMs;

    const recibo = await this.enviar(
      this.conElValidador(
        this.lucid
          .newTx()
          .collectFrom([utxo], encodeAdvanceRedeemer({ to: next.state, completion }))
          .pay.ToContract(
            this.refs.address,
            { kind: "inline", value: encodeStageDatum(next) },
            utxo.assets
          )
          .addSignerKey(this.adminKeyHash())
          .validFrom(desde)
          .validTo(hasta)
      )
    );

    // El hilo que se acaba de gastar deja de ser una respuesta válida para el
    // siguiente avance: si quedara en la vista local, un segundo `advanceThread`
    // sobre el mismo `outputRef` armaría una transacción contra una entrada ya
    // consumida en vez de fallar con `UNKNOWN_THREAD`.
    this.salidasPendientes.delete(outputRef);
    return recibo;
  }

  /**
   * El camino de metadata (D-006): una transacción sin validador que lleva el
   * hash del archivo. No toca el hilo del stage ni el thread token.
   *
   * Las cadenas de metadata tienen tope de 64 bytes por string (regla 2): un
   * SHA-256 en hex ocupa exactamente 64, y la ref va aparte por eso mismo.
   */
  async anchorCommitment({
    sha256,
    reference
  }: CommitmentAnchorInput): Promise<MetadataAnchorReceipt> {
    if (!/^[0-9a-f]{64}$/.test(sha256)) {
      throw new AnchorRejectedError(`No es un SHA-256 en hex: ${sha256}`, "BAD_EVIDENCE_HASH");
    }
    if (reference.length > 64) {
      throw new AnchorRejectedError("La ref no entra en un string de metadata", "REF_TOO_LONG");
    }

    // Las validaciones de arriba quedan **fuera** de la cola a propósito: un
    // hash mal formado no espera detrás de una transacción de treinta segundos
    // para que le digan que está mal formado.
    const { txid } = await this.enCola(() =>
      this.enviar(
        this.lucid.newTx().attachMetadata(EVIDENCE_METADATA_LABEL, { h: sha256, r: reference })
      )
    );
    return { txid, status: "Pending" };
  }

  /**
   * Publica el validador como **reference script**: un UTxO en la dirección de
   * la wallet que lleva el script adentro. A partir de ahí las transacciones lo
   * referencian en vez de adjuntarlo.
   *
   * **Es una operación de operador, no de la API**, y por eso no está en
   * `AnchorPort`: gasta ADA de la wallet de servicio, se hace una vez por red y
   * su efecto no es un anclaje. La corre `scripts/publish-reference-script.mjs`.
   *
   * **Idempotente** (regla 8): vuelve a mirar la cadena antes de publicar. Si ya
   * está, no gasta nada y devuelve el que hay.
   *
   * **La API no lo toma sola**: lo descubre al arrancar, así que después de
   * publicar hay que reiniciarla.
   */
  async publishReferenceScript(): Promise<ReferenceScriptPublication> {
    return this.enCola(async () => {
      const yaEsta = await buscarReferenceScript(
        this.lucid,
        this.walletAddress,
        this.refs.policyId
      );
      if (yaEsta) {
        this.referenceUtxo = yaEsta;
        return {
          outputRef: `${yaEsta.txHash}#${yaEsta.outputIndex}`,
          txid: null,
          lovelace: yaEsta.assets.lovelace ?? 0n
        };
      }

      // Sin `assets`: Lucid calcula el mínimo exacto que el UTxO necesita para
      // existir con el script adentro (`with_asset_and_min_required_coin`).
      // Elegir un número a mano sería o quedarse corto —la transacción se
      // rechaza— o inmovilizar de más para siempre.
      const { salidas, txid } = await this.enviar(
        this.lucid.newTx().pay.ToAddressWithData(this.walletAddress, undefined, undefined, {
          ...this.refs.script
        })
      );

      const publicado = salidas.find(
        (salida) => salida.scriptRef && mintingPolicyToId(salida.scriptRef) === this.refs.policyId
      );
      if (!publicado) {
        throw new Error(
          `La transacción ${txid} se envió pero no dejó ninguna salida con el validador adentro.`
        );
      }

      this.referenceUtxo = publicado;
      return {
        outputRef: `${publicado.txHash}#${publicado.outputIndex}`,
        txid,
        lovelace: publicado.assets.lovelace ?? 0n
      };
    });
  }

  /** El reference script que este adaptador va a usar, si hay alguno. */
  get referenceScriptOutputRef(): OutputRef | null {
    return this.referenceUtxo
      ? `${this.referenceUtxo.txHash}#${this.referenceUtxo.outputIndex}`
      : null;
  }

  /**
   * Verifica contra la cadena, no contra nuestra base.
   *
   * **Alcance de la rebanada B:** confirma que el TXID entró y devuelve el
   * estado ACTUAL del hilo. Reconstruir la historia completa —cada transición
   * con su bloque y su timestamp— necesita un indexer y es la rebanada C.
   */
  async verify(txid: string): Promise<AnchorProof | null> {
    const confirmado = await this.lucid.awaitTx(txid);
    if (!confirmado) return null;
    return this.threadProof(txid);
  }

  /**
   * Una sola consulta a Blockfrost: `/txs/{hash}` responde 404 mientras la
   * transacción no esté en un bloque, y trae `block_time` en segundos cuando sí.
   *
   * **`fetch` pelado y no un cliente**: es un GET a un endpoint que devuelve un
   * campo. Meter una dependencia para eso sería pagar superficie por nada, y el
   * provider de Lucid no expone la consulta —`awaitTx` **bloquea** hasta que
   * confirme, que es justo lo que no queremos en una lectura.
   *
   * **Es el único `fetch` del repo que sale a una red que no controlamos**
   * (SPEC-410), y corre adentro de `reconciliarAnclajes`, que recorre eventos
   * en serie: sin límite, un Blockfrost que acepta la conexión y no contesta
   * cuelga la tanda entera — un request HTTP de la API que nunca cierra, con
   * el disparo por lectura (D-077). El timeout rechaza en vez de dar `null`:
   * no pudo preguntar, así que no puede decir "no confirmó" (mismo criterio
   * que `DisabledAnchorAdapter`). Sin retry: la reconciliación ya es
   * reintentable por diseño, vuelve a correr en la próxima lectura.
   */
  async confirmedAt(txid: string): Promise<number | null> {
    if (!this.blockfrost) return null;

    let res: Response;
    try {
      res = await fetch(`${this.blockfrost.url}/txs/${txid}`, {
        headers: { project_id: this.blockfrost.apiKey },
        signal: AbortSignal.timeout(BLOCKFROST_TIMEOUT_MS)
      });
    } catch (error) {
      throw new Error(`Blockfrost no contestó en ${BLOCKFROST_TIMEOUT_MS}ms al consultar ${txid}`, {
        cause: error
      });
    }

    // 404 es la respuesta normal de una transacción que todavía no entró en un
    // bloque, no un error que haya que propagar.
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Blockfrost respondió ${res.status} al consultar ${txid}`);
    }

    const cuerpo = (await res.json()) as { block_time?: number };
    return typeof cuerpo.block_time === "number" ? cuerpo.block_time * 1000 : null;
  }

  async awaitConfirmation(txid: string): Promise<AnchorProof> {
    const proof = await this.verify(txid);
    if (!proof) {
      throw new AnchorRejectedError(`La transacción ${txid} no confirmó`, "NOT_CONFIRMED");
    }
    return proof;
  }

  private adminKeyHash(): string {
    // El admin es el parámetro con el que se derivó la dirección; recuperarlo
    // del propio script evita guardarlo dos veces.
    return this.refs.adminKeyHash;
  }

  private unitOf(datum: StageDatum): string {
    // El asset name del thread token ES el `stage_ref` (D-058), que en el datum
    // ya viaja en hex.
    return `${this.refs.policyId}${datum.stageRef}`;
  }

  private async utxoAt(outputRef: OutputRef): Promise<UTxO> {
    // La forma entera, no solo que las dos mitades existan (SPEC-410): sin
    // esto, "abc#xyz" pasaba el guard y salía a consultar al proveedor con
    // `outputIndex: NaN` — el error volvía de Lucid, varios frames lejos del
    // dato malo que lo causó.
    const forma = /^([0-9a-f]{64})#(\d+)$/.exec(outputRef);
    if (!forma) {
      throw new AnchorRejectedError(`outputRef mal formado: ${outputRef}`, "BAD_OUTPUT_REF");
    }
    // El regex ya garantiza los dos grupos: `forma[1]`/`forma[2]` no son `undefined`.
    const txHash = forma[1] as string;
    const index = forma[2] as string;

    // La vista local antes que el proveedor, y no al revés: si el hilo está
    // acá es porque esta misma instancia lo creó hace segundos y el proveedor
    // todavía no lo indexó, así que preguntarle primero es una consulta que ya
    // sabemos que va a dar vacío. Nadie más puede haberlo gastado en el medio:
    // el validador exige la firma del admin, que es esta wallet.
    const local = this.salidasPendientes.get(outputRef);
    if (local) return local;

    const [utxo] = await this.lucid.utxosByOutRef([
      { txHash, outputIndex: Number.parseInt(index, 10) }
    ]);

    if (!utxo) {
      throw new AnchorRejectedError(`No existe el UTxO ${outputRef}`, "UNKNOWN_THREAD");
    }
    return utxo;
  }

  /**
   * Encola un trabajo detrás del anterior. Sale por el mismo lugar por el que
   * saldría sin cola: el error del trabajo es el error que ve quien llamó.
   */
  private enCola<T>(trabajo: () => Promise<T>): Promise<T> {
    // La vista local se vence **acá**, antes de que el trabajo lea nada: el
    // primero que la consulta es `utxoAt()`, que corre antes de construir la
    // transacción. Vencerla dentro de `enviar()` llegaría tarde.
    const turnoDe = async () => {
      this.caducarVistaLocal();
      return trabajo();
    };

    // El mismo trabajo en las dos ramas: que el anclaje anterior haya fallado
    // no puede cancelar al siguiente.
    const turno = this.cola.then(turnoDe, turnoDe);
    // Lo que queda guardado como cola es una promesa que **nunca** rechaza. Si
    // se guardara `turno` a secas, un anclaje fallido dejaría un rechazo sin
    // manejar —que en Node mata el proceso— por más que quien llamó lo haya
    // atrapado.
    this.cola = turno.then(
      () => undefined,
      () => undefined
    );
    return turno;
  }

  /**
   * Construye con `chain()` en vez de `complete()`, firma y envía.
   *
   * `chain()` es el mismo `complete()` —devuelve la misma transacción— pero
   * además entrega el conjunto de UTxOs con el que hay que quedarse: los de la
   * wallet menos los que esta transacción gasta, más el vuelto que crea. Eso es
   * exactamente lo que el proveedor va a contestar dentro de ~20 s y lo que hoy
   * no contesta.
   */
  private async enviar(tx: TxBuilder): Promise<AnchorReceipt & { salidas: UTxO[] }> {
    const [utxosDeLaWallet, salidas, firmable] = await tx.chain({
      presetWalletInputs: await this.entradasDeLaWallet()
    });
    const firmada = await firmable.sign.withWallet().complete();
    const txid = await firmada.submit();

    this.anotarLoEnviado(utxosDeLaWallet, salidas);
    return { txid, outputRef: `${txid}#0`, status: "Pending", salidas };
  }

  /**
   * Le da el validador al builder: **por referencia si está publicado, adjunto
   * si no**. Un adjunto son 2289 bytes en cada transacción; una referencia son
   * ~40.
   *
   * `attach.MintingPolicy` y `attach.SpendingValidator` son literalmente la
   * misma función en Lucid, y acá eso además es correcto: el blueprint trae un
   * solo script con tres handlers (`blueprint.ts`).
   */
  private conElValidador(tx: TxBuilder): TxBuilder {
    return this.referenceUtxo
      ? tx.readFrom([this.referenceUtxo])
      : tx.attach.Script(this.refs.script);
  }

  /**
   * Lo que la wallet puede gastar, que **no es todo lo que la wallet tiene**.
   *
   * Un UTxO que lleva un script adentro no es plata disponible: gastarlo borra
   * el reference script, y a partir de ahí toda transacción que lo referencie
   * apunta a una entrada que no existe. Lucid dice en sus errores que excluye
   * esos UTxOs de la selección, pero en 0.6.2 solo excluye los que la propia
   * transacción declaró con `readFrom` — o sea, no los de un anclaje por
   * metadata, que no usa el validador. Se filtra acá, que es el único lugar por
   * el que pasan todas.
   */
  private async entradasDeLaWallet(): Promise<UTxO[]> {
    const todas = await this.lucid.wallet().getUtxos();
    return todas.filter((utxo) => !utxo.scriptRef);
  }

  /**
   * Deja la wallet mirando el vuelto de la transacción recién enviada y guarda
   * las salidas al script que crea.
   *
   * **No se limpia cuando un envío falla**, y es deliberado: si la transacción
   * anterior sí entró al mempool, volver a preguntarle al proveedor devolvería
   * la entrada que esa transacción ya gastó y el siguiente anclaje fallaría
   * igual. La única salida del estado malo —una transacción que el nodo
   * descartó— es que la vista local venza.
   */
  private anotarLoEnviado(utxosDeLaWallet: UTxO[], salidas: UTxO[]): void {
    this.lucid.overrideUTxOs(utxosDeLaWallet);

    for (const salida of salidas) {
      if (salida.address === this.refs.address) {
        this.salidasPendientes.set(`${salida.txHash}#${salida.outputIndex}`, salida);
      }
    }

    this.venceLaVistaLocal = this.now() + this.pendingUtxoTtlMs;
  }

  /**
   * Vuelve a creerle al proveedor cuando la vista local ya no puede aportar
   * nada. Ver `PENDING_UTXO_TTL_MS`.
   */
  private caducarVistaLocal(): void {
    if (this.venceLaVistaLocal === null || this.now() < this.venceLaVistaLocal) return;

    this.salidasPendientes.clear();
    this.venceLaVistaLocal = null;
    this.lucid.clearUTxOOverride();
  }

  private async threadProof(txid: string): Promise<AnchorProof | null> {
    const utxos = await this.lucid.utxosAt(this.refs.address);
    const vivo = utxos.find((u) => u.txHash === txid);
    if (!vivo?.datum) return null;

    return {
      txid,
      outputRef: `${vivo.txHash}#${vivo.outputIndex}`,
      // El timestamp del bloque: `confirmedAt` ya sabe leerlo (SPEC-409). Sin
      // Blockfrost configurado (`Emulator`, devnet) devuelve `null` — honesto,
      // no roto: sin fuente no se afirma un momento que no se puede sostener.
      blockTimestamp: await this.confirmedAt(txid),
      datum: decodeStageDatum(vivo.datum)
    };
  }
}

/**
 * Busca el reference script entre los UTxOs de la wallet.
 *
 * **Se compara el hash del script, no el `outputRef` ni los bytes.** Es la única
 * forma de estar seguro de que el UTxO lleva *este* validador: el hash sale del
 * blueprint con el admin aplicado, así que un script viejo —de antes de un
 * `aiken build`, o de otra wallet— no matchea y se ignora en vez de producir
 * transacciones que referencian el validador equivocado.
 *
 * Vive fuera de la clase porque `create()` la necesita antes de que la instancia
 * exista.
 */
async function buscarReferenceScript(
  lucid: LucidEvolution,
  walletAddress: string,
  scriptHash: string
): Promise<UTxO | null> {
  const utxos = await lucid.utxosAt(walletAddress);
  return (
    utxos.find((utxo) => utxo.scriptRef && mintingPolicyToId(utxo.scriptRef) === scriptHash) ?? null
  );
}
