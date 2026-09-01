import { afterEach, describe, expect, it } from "vitest";
import { anchorPort, initAnchorPort } from "../src/lib/anchor";

// D-075: una configuración de anclaje rota inhabilita el puerto, no mata la API.
//
// Son dos propiedades y las dos importan por separado:
//   1. La API arranca. El día que alguien vuelva a poner un `throw` acá, un
//      push con una variable mal puesta deja producción sin API.
//   2. El puerto inhabilitado no ancla nada. Ese es el punto: degradar no puede
//      significar volver a escribir TXIDs que no existen (regla 17, D-026).

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
  ])("queda inhabilitado con DATABASE_URL=%s — %s", async (url) => {
    process.env.ANCHOR_MODE = "simulated";
    process.env.DATABASE_URL = url;

    const puerto = await initAnchorPort();

    expect(puerto.mode).toBe("disabled");
  });

  it("tampoco ancla cuando ANCHOR_MODE no está puesto: el default es simulated", async () => {
    delete process.env.ANCHOR_MODE;
    process.env.DATABASE_URL = "libsql://propnexus-javote.aws-us-east-1.turso.io";

    const puerto = await initAnchorPort();

    expect(puerto.mode).toBe("disabled");
  });

  it("una base local sí ancla: es el modo de desarrollo y de la suite", async () => {
    process.env.ANCHOR_MODE = "simulated";
    process.env.DATABASE_URL = "file:./.data/test.sqlite";

    await expect(initAnchorPort()).resolves.toMatchObject({ mode: "simulated" });
  });
});

describe("el puerto inhabilitado", () => {
  it("no produce ni un solo TXID: rechaza todo lo que ancla", async () => {
    process.env.ANCHOR_MODE = "simulated";
    process.env.DATABASE_URL = "libsql://propnexus-javote.aws-us-east-1.turso.io";
    await initAnchorPort();

    // El caso que motivó todo: el anclaje de evidencia. Si esto devolviera un
    // recibo, producción volvería a afirmar una prueba inexistente.
    await expect(
      anchorPort().anchorCommitment({ sha256: "a".repeat(64), reference: "ref-opaca" })
    ).rejects.toThrow(/inhabilitado/);
  });

  it("rechaza también las lecturas, en vez de decir que nada confirmó", async () => {
    process.env.ANCHOR_MODE = "simulated";
    process.env.DATABASE_URL = "libsql://propnexus-javote.aws-us-east-1.turso.io";
    await initAnchorPort();

    // `null` significaría "consulté la cadena y no confirmó", y este puerto no
    // consultó nada. Con excepción, `reconcile()` la saltea y queda en el log.
    await expect(anchorPort().confirmedAt("b".repeat(64))).rejects.toThrow(/inhabilitado/);
  });

  it("lleva el motivo adentro del rechazo, para no depender del log de arranque", async () => {
    process.env.ANCHOR_MODE = "simulated";
    process.env.DATABASE_URL = "libsql://propnexus-javote.aws-us-east-1.turso.io";
    await initAnchorPort();

    await expect(anchorPort().confirmedAt("c".repeat(64))).rejects.toThrow(
      /ANCHOR_MODE=simulated contra una base remota/
    );
  });
});

describe("el modo real sin sus secretos", () => {
  const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY;
  const SERVICE_WALLET_PRIVATE_KEY = process.env.SERVICE_WALLET_PRIVATE_KEY;

  afterEach(() => {
    restaurar("BLOCKFROST_API_KEY", BLOCKFROST_API_KEY);
    restaurar("SERVICE_WALLET_PRIVATE_KEY", SERVICE_WALLET_PRIVATE_KEY);
  });

  // Este es el caso que dejaba producción sin API: `render.yaml` en `real` y los
  // secretos todavía sin cargar. Antes de D-075 el proceso moría acá.
  it("inhabilita el puerto en vez de impedir el arranque", async () => {
    process.env.ANCHOR_MODE = "real";
    process.env.DATABASE_URL = "file:./.data/test.sqlite";
    delete process.env.BLOCKFROST_API_KEY;
    delete process.env.SERVICE_WALLET_PRIVATE_KEY;

    const puerto = await initAnchorPort();

    expect(puerto.mode).toBe("disabled");
    await expect(
      anchorPort().anchorCommitment({ sha256: "d".repeat(64), reference: "ref" })
    ).rejects.toThrow(/BLOCKFROST_API_KEY/);
  });
});
