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

/** Ventana de validez de la transacción. El validador exige las dos puntas
 * finitas y que `completed_at` caiga adentro. */
export const VALIDITY_WINDOW_MS = 10 * 60 * 1000;

export interface LucidAnchorOptions {
  lucid: LucidEvolution;
  network: Network;
  blueprint?: Blueprint;
  /** Reloj inyectable: los tests fijan el tiempo, no lo padecen. */
  now?: () => number;
}

export class LucidAnchorAdapter implements AnchorPort {
  readonly mode = "real" as const;

  private readonly lucid: LucidEvolution;
  private readonly refs: StageScriptRefs;
  private readonly now: () => number;

  private constructor(lucid: LucidEvolution, refs: StageScriptRefs, now: () => number) {
    this.lucid = lucid;
    this.refs = refs;
    this.now = now;
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

    return new LucidAnchorAdapter(options.lucid, refs, options.now ?? (() => Date.now()));
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
    const desde = completion ? Math.min(now, completion.now) - 1000 : now - 1000;
    const hasta = Math.max(now, completion?.now ?? now) + VALIDITY_WINDOW_MS;

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
