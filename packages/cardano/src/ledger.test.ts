import { describe, expect, it } from "vitest";
import { InMemoryLedgerStore } from "./ledger";

// El resto del comportamiento de InMemoryLedgerStore ya está cubierto
// indirectamente por simulated.test.ts (es el store que usa el simulador).
// Este archivo cierra lo que ningún camino de producción ejercita: markSpent
// sobre un outputRef que el ledger nunca vio.
describe("InMemoryLedgerStore.markSpent", () => {
  it("es un no-op silencioso sobre un outputRef que no existe — no inventa un UTxO", async () => {
    const store = new InMemoryLedgerStore();

    await store.markSpent("no-existe#0", "tx1");

    expect(await store.get("no-existe#0")).toBeUndefined();
  });
});
