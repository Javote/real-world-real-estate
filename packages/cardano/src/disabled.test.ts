import { describe, expect, it } from "vitest";
import { ANCHOR_DISABLED, DisabledAnchorAdapter } from "./disabled";
import { AnchorRejectedError } from "./port";

// D-075. Lo que se fija acá es una sola cosa, y es la que hace segura a la
// degradación: **ningún método devuelve**. Un puerto que degrada devolviendo
// algo plausible sería peor que uno que mata el proceso, porque volvería a
// poner en la base señales de prueba sin cadena detrás (regla 17, D-026).
//
// TypeScript ya obliga a implementar cada método de `AnchorPort`. Lo que no
// mira es si alguno **contesta** en vez de rechazar, y eso es justo el error que
// costaría caro: por eso se recorren todos, y no una muestra.

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
    ["verify", () => puerto.verify(TXID)],
    ["awaitConfirmation", () => puerto.awaitConfirmation(TXID)],
    ["confirmedAt", () => puerto.confirmedAt(TXID)]
  ];

  it.each(llamadas)("%s rechaza y no devuelve", async (_nombre, llamar) => {
    await expect(llamar()).rejects.toBeInstanceOf(AnchorRejectedError);
  });

  it("el rechazo trae el motivo y un código estable", async () => {
    // El código es lo que deja distinguir "el anclaje está apagado" de "el
    // validador rechazó esta transición", que son problemas de distinta
    // naturaleza aunque los dos terminen en un evento `Failed`.
    await expect(puerto.confirmedAt(TXID)).rejects.toMatchObject({
      code: ANCHOR_DISABLED,
      message: expect.stringContaining(MOTIVO)
    });
  });
});
