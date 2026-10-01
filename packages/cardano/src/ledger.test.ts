import { describe, expect, it } from "vitest";
import { InMemoryLedgerStore } from "./ledger";

describe("InMemoryLedgerStore.markSpent", () => {
  it("es un no-op silencioso sobre un outputRef que no existe — no inventa un UTxO", async () => {
    const store = new InMemoryLedgerStore();

    await store.markSpent("no-existe#0", "tx1");

    expect(await store.get("no-existe#0")).toBeUndefined();
  });
});
