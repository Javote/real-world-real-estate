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

export const THREAD_MIN_LOVELACE = 2_000_000n;

// Más de 300 s pasa el safe zone de la era en un devnet y el nodo responde PastHorizon.
export const VALIDITY_WINDOW_MS = 3 * 60 * 1000;

// El nodo valida la ventana contra el slot del último bloque, no contra su reloj.
export const TIP_LAG_MARGIN_MS = 2 * 60 * 1000;

export const PENDING_UTXO_TTL_MS = 3 * 60 * 1000;

export const BLOCKFROST_TIMEOUT_MS = 10 * 1000;

export interface ReferenceScriptPublication {
  outputRef: OutputRef;
  txid: string | null;
  lovelace: bigint;
}

export interface LucidAnchorOptions {
  lucid: LucidEvolution;
  network: Network;
  blueprint?: Blueprint;
  validityWindowMs?: number;
  tipLagMarginMs?: number;
  pendingUtxoTtlMs?: number;
  now?: () => number;
  blockfrost?: { url: string; apiKey: string };
}

export class LucidAnchorAdapter implements AnchorPort {
  readonly mode = "real" as const;

  readonly network: AnchorNetwork;

  readonly walletAddress: string;

  private readonly lucid: LucidEvolution;
  private readonly refs: StageScriptRefs;
  private readonly now: () => number;

  private readonly validityWindowMs: number;
  private readonly tipLagMarginMs: number;
  private readonly pendingUtxoTtlMs: number;
  private readonly blockfrost: { url: string; apiKey: string } | undefined;

  private cola: Promise<unknown> = Promise.resolve();

  private readonly salidasPendientes = new Map<OutputRef, UTxO>();

  private venceLaVistaLocal: number | null = null;

  private referenceUtxo: UTxO | null;

  private constructor(config: {
    lucid: LucidEvolution;
    refs: StageScriptRefs;
    walletAddress: string;
    network: AnchorNetwork;
    now: () => number;
    validityWindowMs: number;
    tipLagMarginMs: number;
    pendingUtxoTtlMs: number;
    blockfrost: { url: string; apiKey: string } | undefined;
    referenceUtxo: UTxO | null;
  }) {
    this.lucid = config.lucid;
    this.network = config.network;
    this.refs = config.refs;
    this.walletAddress = config.walletAddress;
    this.now = config.now;
    this.validityWindowMs = config.validityWindowMs;
    this.tipLagMarginMs = config.tipLagMarginMs;
    this.pendingUtxoTtlMs = config.pendingUtxoTtlMs;
    this.blockfrost = config.blockfrost;
    this.referenceUtxo = config.referenceUtxo;
  }

  get address(): string {
    return this.refs.address;
  }

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

    const referenceUtxo = await buscarReferenceScript(options.lucid, walletAddress, refs.policyId);

    return new LucidAnchorAdapter({
      lucid: options.lucid,
      refs,
      walletAddress,
      network: options.network,
      now: options.now ?? (() => Date.now()),
      validityWindowMs: options.validityWindowMs ?? VALIDITY_WINDOW_MS,
      tipLagMarginMs: options.tipLagMarginMs ?? TIP_LAG_MARGIN_MS,
      pendingUtxoTtlMs: options.pendingUtxoTtlMs ?? PENDING_UTXO_TTL_MS,
      blockfrost: options.blockfrost,
      referenceUtxo
    });
  }

  async openThread({ datum }: OpenThreadInput): Promise<AnchorReceipt> {
    const unit = this.unitOf(datum);

    return this.enCola(async () =>
      this.reciboDelHilo(
        unit,
        await this.enviar(
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
      )
    );
  }

  async advanceThread(input: AdvanceThreadInput): Promise<AnchorReceipt> {
    return this.enCola(() => this.avanzar(input));
  }

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
    const utxo = await this.utxoAt(outputRef);
    const now = this.now();

    const completion =
      next.state === "Completed"
        ? { evidenceRoot: next.evidenceRoot, now: next.completedAt }
        : null;

    const origen = this.lucid.slotToUnixTime(0);
    const desde = Math.max(
      origen,
      (completion ? Math.min(now, completion.now) : now) - this.tipLagMarginMs
    );
    const hasta = Math.max(now, completion?.now ?? now) + this.validityWindowMs;

    const enviado = await this.enviar(
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

    this.salidasPendientes.delete(outputRef);
    return this.reciboDelHilo(this.unitOf(next), enviado);
  }

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

    const { txid } = await this.enCola(() =>
      this.enviar(
        this.lucid.newTx().attachMetadata(EVIDENCE_METADATA_LABEL, { h: sha256, r: reference })
      )
    );
    return { txid, status: "Pending" };
  }

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
          /* v8 ignore next -- @preserve: `Assets = Record<Unit | "lovelace", bigint>` (@lucid-evolution/core-types) — `lovelace` no es opcional, nunca es `undefined` */
          lovelace: yaEsta.assets.lovelace ?? 0n
        };
      }

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
        /* v8 ignore next -- @preserve: mismo motivo que arriba — `lovelace` no es opcional en `Assets` */
        lovelace: publicado.assets.lovelace ?? 0n
      };
    });
  }

  get referenceScriptOutputRef(): OutputRef | null {
    return this.referenceUtxo
      ? `${this.referenceUtxo.txHash}#${this.referenceUtxo.outputIndex}`
      : null;
  }

  async verify(txid: string): Promise<AnchorProof | null> {
    const confirmado = await this.lucid.awaitTx(txid);
    if (!confirmado) return null;
    return this.threadProof(txid);
  }

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
    return this.refs.adminKeyHash;
  }

  private unitOf(datum: StageDatum): string {
    return `${this.refs.policyId}${datum.stageRef}`;
  }

  private async utxoAt(outputRef: OutputRef): Promise<UTxO> {
    const forma = /^([0-9a-f]{64})#(\d+)$/.exec(outputRef);
    if (!forma) {
      throw new AnchorRejectedError(`outputRef mal formado: ${outputRef}`, "BAD_OUTPUT_REF");
    }
    const txHash = forma[1] as string;
    const index = forma[2] as string;

    // Primero lo que este proceso envió y el proveedor todavía no indexó.
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

  private enCola<T>(trabajo: () => Promise<T>): Promise<T> {
    const turnoDe = async () => {
      // Antes del trabajo: `utxoAt()` lee la vista local antes de construir nada.
      this.caducarVistaLocal();
      return trabajo();
    };

    const turno = this.cola.then(turnoDe, turnoDe);
    // La cola guarda una promesa que nunca rechaza: un rechazo sin manejar mata el proceso.
    this.cola = turno.then(
      () => undefined,
      () => undefined
    );
    return turno;
  }

  private async enviar(tx: TxBuilder): Promise<{ txid: string; salidas: UTxO[] }> {
    // `chain()` y no `complete()`: devuelve el vuelto que encadena el próximo envío.
    const [utxosDeLaWallet, salidas, firmable] = await tx.chain({
      presetWalletInputs: await this.entradasDeLaWallet()
    });
    const firmada = await firmable.sign.withWallet().complete();
    const txid = await firmada.submit();

    this.anotarLoEnviado(utxosDeLaWallet, salidas);
    return { txid, salidas };
  }

  // El token y no la dirección: cualquiera puede pagarle al script, solo el validador acuña el token.
  private reciboDelHilo(
    unit: string,
    { txid, salidas }: { txid: string; salidas: UTxO[] }
  ): AnchorReceipt {
    const hilo = salidas.find(
      (salida) => salida.address === this.refs.address && (salida.assets[unit] ?? 0n) > 0n
    );
    if (!hilo) {
      throw new Error(`La transacción ${txid} se envió pero no dejó el hilo en el script.`);
    }
    return { txid, outputRef: `${hilo.txHash}#${hilo.outputIndex}`, status: "Pending" };
  }

  private conElValidador(tx: TxBuilder): TxBuilder {
    return this.referenceUtxo
      ? tx.readFrom([this.referenceUtxo])
      : tx.attach.Script(this.refs.script);
  }

  private async entradasDeLaWallet(): Promise<UTxO[]> {
    const todas = await this.lucid.wallet().getUtxos();
    // Gastar el UTxO del reference script lo borra; Lucid no lo excluye en un anclaje por metadata.
    return todas.filter((utxo) => !utxo.scriptRef);
  }

  private anotarLoEnviado(utxosDeLaWallet: UTxO[], salidas: UTxO[]): void {
    this.lucid.overrideUTxOs(utxosDeLaWallet);

    for (const salida of salidas) {
      if (salida.address === this.refs.address) {
        this.salidasPendientes.set(`${salida.txHash}#${salida.outputIndex}`, salida);
      }
    }

    this.venceLaVistaLocal = this.now() + this.pendingUtxoTtlMs;
  }

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
      blockTimestamp: await this.confirmedAt(txid),
      datum: decodeStageDatum(vivo.datum)
    };
  }
}

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
