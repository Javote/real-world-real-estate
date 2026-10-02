import { describe, expect, it } from "vitest";
import { conTecho } from "../src/db/migrate.js";

describe("conTecho", () => {
  it("deja pasar el valor cuando la promesa responde a tiempo", async () => {
    await expect(conTecho(Promise.resolve(7), "la base", 1_000)).resolves.toBe(7);
  });

  it("propaga el error real de la promesa, no lo tapa con el techo", async () => {
    const rota = Promise.reject(new Error("SQLITE_CANTOPEN"));

    await expect(conTecho(rota, "la base", 1_000)).rejects.toThrow(/SQLITE_CANTOPEN/);
  });

  it("rechaza diciendo QUÉ no respondió y en cuánto, si nunca contesta", async () => {
    const colgada = new Promise<never>(() => {});

    await expect(conTecho(colgada, "la base", 20)).rejects.toThrow("la base no respondió en 0.02s");
  });

  it("no deja el timer vivo cuando la promesa gana la carrera", async () => {
    const antes = process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;
    await conTecho(Promise.resolve("ok"), "la base", 60_000);

    expect(process.getActiveResourcesInfo().filter((r) => r === "Timeout").length).toBe(antes);
  });
});
