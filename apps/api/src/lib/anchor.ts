import type { AnchorPort, LedgerStore, LedgerUtxo, OutputRef } from "@plataforma/cardano";
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

// ── El puerto del proceso ──────────────────────────────────────────────────
//
// **Se arma en el arranque, no al importar este módulo.** Con `real`, construir
// el puerto es I/O: hay que levantar Lucid contra Blockfrost y preguntarle la
// dirección a la wallet. Eso no se puede hacer sincrónicamente, y sobre todo no
// se debe hacer perezosamente: una seed inválida o un Blockfrost caído tienen
// que impedir que la API levante —visible en los logs de Render, que es lo único
// que hay— y no romper el primer anclaje con evidencia ya subida (D-042).
//
// Es el mismo patrón que las migraciones: antes de escuchar, o no se escucha.

let puerto: AnchorPort | null = null;

/** Llamado por `server.ts` antes de `listen`, y por el setup de la suite. */
export async function initAnchorPort(): Promise<AnchorPort> {
  puerto = await createAnchorPort({
    mode: process.env.ANCHOR_MODE,
    store: new KyselyLedgerStore(),
    blockfrostApiKey: process.env.BLOCKFROST_API_KEY,
    seed: process.env.SERVICE_WALLET_SEED,
    network: process.env.CARDANO_NETWORK,
    blockfrostUrl: process.env.BLOCKFROST_URL
  });
  return puerto;
}

/**
 * El puerto ya construido. Es función y no constante justamente para que el
 * momento de la construcción sea una decisión del proceso y no un efecto de
 * quién importó qué primero.
 */
export function anchorPort(): AnchorPort {
  if (!puerto) {
    throw new Error(
      "El AnchorPort no está inicializado: falta `await initAnchorPort()` antes de usarlo."
    );
  }
  return puerto;
}
