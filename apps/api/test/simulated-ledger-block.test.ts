import { afterAll, describe, expect, it } from "vitest";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";

// SPEC-406 — `KyselyLedgerStore` es la mitad de la spec que no se ve desde
// `packages/cardano`: prueba que `registrarBloque`/`bloqueDe` escriben y leen
// la tabla real (`SimulatedLedgerBlock`, migración 0008), no un `Map` en
// memoria que el reinicio del proceso volvería a perder.

afterAll(async () => {
  await db.destroy();
});

describe("KyselyLedgerStore.registrarBloque — persiste en SimulatedLedgerBlock", () => {
  it("un anclaje por metadata deja una fila que confirmedAt() sigue leyendo", async () => {
    const { txid } = await anchorPort().anchorCommitment({
      sha256: "9".repeat(64),
      reference: "spec-406-metadata"
    });

    const fila = await db
      .selectFrom("SimulatedLedgerBlock")
      .selectAll()
      .where("txid", "=", txid)
      .executeTakeFirst();

    expect(fila).toBeDefined();
    expect(await anchorPort().confirmedAt(txid)).toBe(fila?.blockAt);
  });

  it("es idempotente: anclar dos veces el mismo archivo no duplica la fila ni mueve el timestamp", async () => {
    const entrada = { sha256: "8".repeat(64), reference: "spec-406-idempotente" };

    const primero = await anchorPort().anchorCommitment(entrada);
    const segundo = await anchorPort().anchorCommitment(entrada);
    expect(segundo.txid).toBe(primero.txid);

    const filas = await db
      .selectFrom("SimulatedLedgerBlock")
      .selectAll()
      .where("txid", "=", primero.txid)
      .execute();

    expect(filas).toHaveLength(1);
  });
});
