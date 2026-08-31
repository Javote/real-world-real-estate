import { afterEach, describe, expect, it } from "vitest";
import { anchorPort, initAnchorPort } from "../src/lib/anchor";

// Defensa 1 del PLAN-2026-08-31: el simulador no arranca contra una base
// remota. Es la que convierte en ruidosa una falla que hasta el 2026-08-31 era
// silenciosa —producción escribiendo TXIDs inventados y marcándolos
// `Confirmed`— y por eso tiene test propio: el día que alguien la "simplifique",
// esto se pone rojo.

const ANCHOR_MODE = process.env.ANCHOR_MODE;
const DATABASE_URL = process.env.DATABASE_URL;

function restaurar(clave: string, valor: string | undefined) {
  if (valor === undefined) delete process.env[clave];
  else process.env[clave] = valor;
}

afterEach(() => {
  restaurar("ANCHOR_MODE", ANCHOR_MODE);
  restaurar("DATABASE_URL", DATABASE_URL);
});

describe("el simulador contra una base remota", () => {
  it.each([
    ["libsql://propnexus-javote.aws-us-east-1.turso.io", "por el esquema libsql://"],
    ["https://propnexus-javote.aws-us-east-1.turso.io", "por el host, aunque hable https"]
  ])("no arranca con DATABASE_URL=%s — %s", async (url) => {
    process.env.ANCHOR_MODE = "simulated";
    process.env.DATABASE_URL = url;

    await expect(initAnchorPort()).rejects.toThrow(/no se distinguen de los reales/);
  });

  it("tampoco arranca cuando ANCHOR_MODE no está puesto: el default es simulated", async () => {
    delete process.env.ANCHOR_MODE;
    process.env.DATABASE_URL = "libsql://propnexus-javote.aws-us-east-1.turso.io";

    await expect(initAnchorPort()).rejects.toThrow(/ANCHOR_MODE=simulated/);
  });

  it("una base local sí arranca: es el modo de desarrollo y de la suite", async () => {
    process.env.ANCHOR_MODE = "simulated";
    process.env.DATABASE_URL = "file:./.data/test.sqlite";

    await expect(initAnchorPort()).resolves.toMatchObject({ mode: "simulated" });
  });

  it("el rechazo ocurre antes de construir el puerto: el que ya había sigue en pie", async () => {
    const previo = anchorPort();

    process.env.ANCHOR_MODE = "simulated";
    process.env.DATABASE_URL = "libsql://propnexus-javote.aws-us-east-1.turso.io";
    await expect(initAnchorPort()).rejects.toThrow();

    expect(anchorPort()).toBe(previo);
  });
});
