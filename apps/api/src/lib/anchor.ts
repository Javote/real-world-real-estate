import type { LedgerStore, LedgerUtxo, OutputRef } from "@plataforma/cardano";
import { createAnchorPort } from "@plataforma/cardano";
import type { StageDatum } from "@plataforma/shared";
import { db } from "./db";

// El cableado del `AnchorPort` (SPEC-013 §A). La API no sabe que Cardano
// existe: pide el puerto, lo usa, y el día que aparezca el adaptador real
// (rebanada B) esta configuración es lo único que cambia.

/** El ledger del simulador, sobre la misma SQLite. Ver `0002_simulated_ledger.sql`. */
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

/**
 * El puerto del proceso. `ANCHOR_MODE` no tiene default inseguro (D-042):
 * ausente es `simulated`, y `real` revienta acá hasta que exista la rebanada B.
 */
export const anchorPort = createAnchorPort({
  mode: process.env.ANCHOR_MODE,
  store: new KyselyLedgerStore()
});
