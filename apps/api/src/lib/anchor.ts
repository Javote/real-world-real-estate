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

/**
 * El simulador contra una base remota no arranca.
 *
 * **Por qué existe.** El simulador devuelve TXIDs bien formados marcados
 * `Confirmed` (`simulated.ts`), y `OnChainEvent` no registra de qué modo vino un
 * anclaje: en la base, uno inventado es indistinguible de uno real. El
 * 2026-08-31 producción tenía exactamente eso —un `EVIDENCE_ANCHOR` `Confirmed`
 * con un txid que no existe en Preprod—, afirmando una prueba inexistente
 * contra la regla 17 y D-026.
 *
 * **Por qué acá y no en el factory.** El factory no sabe qué base hay del otro
 * lado; es la API la que junta las dos configuraciones. Y va antes de
 * `createAnchorPort` para que falle en el arranque y no en el primer anclaje,
 * mismo criterio que D-042: sin `listen`, y visible en los logs de Render.
 *
 * Simular contra Turso no tiene ningún caso de uso legítimo, así que no hay
 * escotilla de escape. El camino conocido para llegar a este estado sin querer
 * es un re-sync del Blueprint pisando el `ANCHOR_MODE` del dashboard, que hasta
 * hoy pasaba **en silencio**: esto lo vuelve ruidoso.
 */
function rechazarSimuladoContraBaseRemota(): void {
  const modo = process.env.ANCHOR_MODE ?? "simulated";
  const url = process.env.DATABASE_URL ?? "";
  // Turso se habla por `libsql://`; `https://` contra el mismo host también
  // llega, así que se mira el host y no solo el esquema.
  const esRemota = url.startsWith("libsql://") || url.includes(".turso.io");

  if (modo === "simulated" && esRemota) {
    throw new Error(
      "ANCHOR_MODE=simulated contra una base remota: el simulador escribe TXIDs " +
        "falsos marcados Confirmed que no se distinguen de los reales (regla 17, D-026). " +
        "Poné ANCHOR_MODE=real, o apuntá DATABASE_URL a una base local."
    );
  }
}

/** Llamado por `server.ts` antes de `listen`, y por el setup de la suite. */
export async function initAnchorPort(): Promise<AnchorPort> {
  rechazarSimuladoContraBaseRemota();

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
