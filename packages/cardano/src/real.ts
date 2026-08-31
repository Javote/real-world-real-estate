import {
  type LucidEvolution,
  type Network,
  paymentCredentialOf,
  type TxSignBuilder,
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
  type AnchorPort,
  type AnchorProof,
  type AnchorReceipt,
  AnchorRejectedError,
  type CommitmentAnchorInput,
  EVIDENCE_METADATA_LABEL,
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

export interface LucidAnchorOptions {
  lucid: LucidEvolution;
  network: Network;
  blueprint?: Blueprint;
  /** Ancho de la ventana de validez. Ver `VALIDITY_WINDOW_MS`. */
  validityWindowMs?: number;
  /** Margen hacia atrás por el retraso del tip. Ver `TIP_LAG_MARGIN_MS`. */
  tipLagMarginMs?: number;
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

  private readonly lucid: LucidEvolution;
  private readonly refs: StageScriptRefs;
  private readonly now: () => number;

  private readonly validityWindowMs: number;
  private readonly tipLagMarginMs: number;
  private readonly blockfrost: { url: string; apiKey: string } | undefined;

  private constructor(
    lucid: LucidEvolution,
    refs: StageScriptRefs,
    now: () => number,
    validityWindowMs: number,
    tipLagMarginMs: number,
    blockfrost: { url: string; apiKey: string } | undefined
  ) {
    this.lucid = lucid;
    this.refs = refs;
    this.now = now;
    this.validityWindowMs = validityWindowMs;
    this.tipLagMarginMs = tipLagMarginMs;
    this.blockfrost = blockfrost;
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

    return new LucidAnchorAdapter(
      options.lucid,
      refs,
      options.now ?? (() => Date.now()),
      options.validityWindowMs ?? VALIDITY_WINDOW_MS,
      options.tipLagMarginMs ?? TIP_LAG_MARGIN_MS,
      options.blockfrost
    );
  }

  /** `mint`: acuña el thread token y crea el hilo en `Pending`. */
  async openThread({ datum }: OpenThreadInput): Promise<AnchorReceipt> {
    const unit = this.unitOf(datum);

    const tx = await this.lucid
      .newTx()
      .mintAssets({ [unit]: 1n }, encodeInitRedeemer())
      .pay.ToContract(
        this.refs.address,
        { kind: "inline", value: encodeStageDatum(datum) },
        { lovelace: THREAD_MIN_LOVELACE, [unit]: 1n }
      )
      .attach.MintingPolicy(this.refs.script)
      .addSignerKey(this.adminKeyHash())
      .complete();

    return this.submit(tx);
  }

  /** `spend`: gasta el hilo y lo recrea con el datum nuevo. */
  async advanceThread({ outputRef, next }: AdvanceThreadInput): Promise<AnchorReceipt> {
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

    const tx = await this.lucid
      .newTx()
      .collectFrom([utxo], encodeAdvanceRedeemer({ to: next.state, completion }))
      .pay.ToContract(
        this.refs.address,
        { kind: "inline", value: encodeStageDatum(next) },
        utxo.assets
      )
      .attach.SpendingValidator(this.refs.script)
      .addSignerKey(this.adminKeyHash())
      .validFrom(desde)
      .validTo(hasta)
      .complete();

    return this.submit(tx);
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

    const tx = await this.lucid
      .newTx()
      .attachMetadata(EVIDENCE_METADATA_LABEL, { h: sha256, r: reference })
      .complete();

    const { txid } = await this.submit(tx);
    return { txid, status: "Pending" };
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
   */
  async confirmedAt(txid: string): Promise<number | null> {
    if (!this.blockfrost) return null;

    const res = await fetch(`${this.blockfrost.url}/txs/${txid}`, {
      headers: { project_id: this.blockfrost.apiKey }
    });

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
    const [txHash, index] = outputRef.split("#");
    if (!txHash || index === undefined) {
      throw new AnchorRejectedError(`outputRef mal formado: ${outputRef}`, "BAD_OUTPUT_REF");
    }

    const [utxo] = await this.lucid.utxosByOutRef([
      { txHash, outputIndex: Number.parseInt(index, 10) }
    ]);

    if (!utxo) {
      throw new AnchorRejectedError(`No existe el UTxO ${outputRef}`, "UNKNOWN_THREAD");
    }
    return utxo;
  }

  private async submit(tx: TxSignBuilder): Promise<AnchorReceipt> {
    const signed = await tx.sign.withWallet().complete();
    const txid = await signed.submit();
    return { txid, outputRef: `${txid}#0`, status: "Pending" };
  }

  private async threadProof(txid: string): Promise<AnchorProof | null> {
    const utxos = await this.lucid.utxosAt(this.refs.address);
    const vivo = utxos.find((u) => u.txHash === txid);
    if (!vivo?.datum) return null;

    return {
      txid,
      outputRef: `${vivo.txHash}#${vivo.outputIndex}`,
      // El timestamp autoritativo es el del bloque; leerlo necesita el indexer
      // de la rebanada C. Hasta entonces, el momento de la confirmación.
      blockTimestamp: this.now(),
      datum: decodeStageDatum(vivo.datum)
    };
  }
}
