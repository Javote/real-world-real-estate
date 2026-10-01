import { describe, expect, it } from "vitest";
import { ANCHOR_DISABLED, DisabledAnchorAdapter } from "./disabled";
import { AnchorRejectedError } from "./port";

const MOTIVO = "falta BLOCKFROST_API_KEY";
const TXID = "a".repeat(64);

describe("DisabledAnchorAdapter", () => {
  const puerto = new DisabledAnchorAdapter(MOTIVO);

  it("no dice ser simulated ni real: no puede ejercer ninguno de los dos", () => {
    expect(puerto.mode).toBe("disabled");
  });

  const llamadas: [string, () => Promise<unknown>][] = [
    ["openThread", () => puerto.openThread({} as never)],
    ["advanceThread", () => puerto.advanceThread({} as never)],
    ["anchorCommitment", () => puerto.anchorCommitment({ sha256: TXID, reference: "r" })],
    ["findLiveThread", () => puerto.findLiveThread("stage-ref")],
    ["verify", () => puerto.verify(TXID)],
    ["awaitConfirmation", () => puerto.awaitConfirmation(TXID)],
    ["confirmedAt", () => puerto.confirmedAt(TXID)]
  ];

  it.each(llamadas)("%s rechaza y no devuelve", async (_nombre, llamar) => {
    await expect(llamar()).rejects.toBeInstanceOf(AnchorRejectedError);
  });

  it("el rechazo trae el motivo y un código estable", async () => {
    await expect(puerto.confirmedAt(TXID)).rejects.toMatchObject({
      code: ANCHOR_DISABLED,
      message: expect.stringContaining(MOTIVO)
    });
  });
});
