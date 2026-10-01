import type { AnchorPort, LedgerStore, LedgerUtxo, OutputRef } from "@plataforma/cardano";
import { createAnchorPort, DisabledAnchorAdapter } from "@plataforma/cardano";
import type { StageDatum } from "@plataforma/shared";
import { db } from "./db";

class KyselyLedgerStore implements LedgerStore {
  async get(outputRef: OutputRef): Promise<LedgerUtxo | undefined> {
    const fila = await db
      .selectFrom("SimulatedLedgerUtxo")
      .selectAll()
      .where("outputRef", "=", outputRef)
      .executeTakeFirst();

    return fila ? KyselyLedgerStore.toUtxo(fila) : undefined;
  }

  async findLive(assetName: string): Promise<LedgerUtxo | undefined> {
    const fila = await db
      .selectFrom("SimulatedLedgerUtxo")
      .selectAll()
      .where("assetName", "=", assetName)
      .where("spentByTxid", "is", null)
      .executeTakeFirst();

    return fila ? KyselyLedgerStore.toUtxo(fila) : undefined;
  }

  async put(utxo: LedgerUtxo): Promise<void> {
    await db
      .insertInto("SimulatedLedgerUtxo")
      .values({
        outputRef: utxo.outputRef,
        assetName: utxo.assetName,
        datumJson: JSON.stringify(utxo.datum),
        spentByTxid: utxo.spentByTxid,
        createdAt: new Date()
      })
      .execute();
  }

  async markSpent(outputRef: OutputRef, spentByTxid: string): Promise<void> {
    await db
      .updateTable("SimulatedLedgerUtxo")
      .set({ spentByTxid })
      .where("outputRef", "=", outputRef)
      .execute();
  }

  async registrarBloque(txid: string, at: number): Promise<void> {
    await db
      .insertInto("SimulatedLedgerBlock")
      .values({ txid, blockAt: at })
      .onConflict((oc) => oc.column("txid").doNothing())
      .execute();
  }

  async bloqueDe(txid: string): Promise<number | undefined> {
    const fila = await db
      .selectFrom("SimulatedLedgerBlock")
      .select("blockAt")
      .where("txid", "=", txid)
      .executeTakeFirst();
    return fila?.blockAt;
  }

  private static toUtxo(fila: {
    outputRef: string;
    assetName: string;
    datumJson: string;
    spentByTxid: string | null;
  }): LedgerUtxo {
    return {
      outputRef: fila.outputRef,
      assetName: fila.assetName,
      datum: JSON.parse(fila.datumJson) as StageDatum,
      spentByTxid: fila.spentByTxid
    };
  }
}

let puerto: AnchorPort | null = null;

export function motivoParaNoAnclar(): string | null {
  const modo = process.env.ANCHOR_MODE ?? "simulated";
  const url = process.env.DATABASE_URL ?? "";
  const esRemota = url.startsWith("libsql://") || url.includes(".turso.io");

  if (modo === "simulated" && esRemota) {
    return (
      "ANCHOR_MODE=simulated contra una base remota. El simulador escribe TXIDs falsos " +
      "marcados Confirmed que no se distinguen de los reales (regla 17, D-026). " +
      "Poné ANCHOR_MODE=real, o apuntá DATABASE_URL a una base local."
    );
  }

  return null;
}

function inhabilitar(motivo: string): AnchorPort {
  console.error(
    `[anchor] ANCLAJE INHABILITADO — la API arranca igual, pero todo anclaje va a fallar.\n` +
      `         Motivo: ${motivo}`
  );
  return new DisabledAnchorAdapter(motivo);
}

export async function initAnchorPort(): Promise<AnchorPort> {
  const motivo = motivoParaNoAnclar();
  if (motivo) {
    puerto = inhabilitar(motivo);
    return puerto;
  }

  try {
    puerto = await createAnchorPort({
      mode: process.env.ANCHOR_MODE,
      store: new KyselyLedgerStore(),
      blockfrostApiKey: process.env.BLOCKFROST_API_KEY,
      privateKey: process.env.SERVICE_WALLET_PRIVATE_KEY,
      network: process.env.CARDANO_NETWORK,
      blockfrostUrl: process.env.BLOCKFROST_URL
    });
  } catch (error) {
    puerto = inhabilitar(error instanceof Error ? error.message : String(error));
  }

  return puerto;
}

export function anchorPort(): AnchorPort {
  if (!puerto) {
    throw new Error(
      "El AnchorPort no está inicializado: falta `await initAnchorPort()` antes de usarlo."
    );
  }
  return puerto;
}
