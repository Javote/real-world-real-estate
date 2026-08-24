import { generateSeedPhrase, Kupmios, Lucid } from "@lucid-evolution/lucid";
import { buildStageDatum } from "@plataforma/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { LucidAnchorAdapter } from "./real";

// SPEC-013 §B, el escalón de realismo: **un nodo Cardano de verdad**, local.
//
// El `Emulator` ejecuta el validador pero no ejercita el provider: no hay
// consulta de UTxOs por HTTP, ni parámetros de protocolo del nodo, ni fees
// reales, ni bloques. Este archivo cierra ese hueco contra yaci-devkit, que
// levanta un devnet con bloques de 1 segundo y una API compatible con
// Blockfrost.
//
// **No corre en CI** (el CI no levanta infraestructura). Se corre a mano:
//
//   docker compose -f compose.dev.yml up -d
//   pnpm --filter @plataforma/cardano test:yaci
//
// El adaptador es EXACTAMENTE el mismo que corre contra el Emulator y el que
// va a correr contra Preprod: lo único que cambia es el provider.
const corre = process.env.YACI_TEST === "1";

const STORE_URL = process.env.YACI_STORE_URL ?? "http://localhost:8080/api/v1";
const ADMIN_URL = process.env.YACI_ADMIN_URL ?? "http://localhost:10000";
const KUPO_URL = process.env.YACI_KUPO_URL ?? "http://localhost:1442";
const OGMIOS_URL = process.env.YACI_OGMIOS_URL ?? "http://localhost:1337";

const fuente = {
  id: "clh3k9x0000008l3fyaci001",
  projectId: "clh3k9x0000008l3fyaciprj",
  sequenceOrder: 1,
  validationCritical: true,
  state: "Pending" as const
};

const root = "d".repeat(64);

/** Fondea la wallet desde el devkit. En una red de verdad, esto es el faucet. */
async function topup(address: string, ada: number): Promise<void> {
  const res = await fetch(`${ADMIN_URL}/local-cluster/api/addresses/topup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, adaAmount: ada })
  });
  if (!res.ok) throw new Error(`topup falló: ${res.status} ${await res.text()}`);
}

/**
 * El i64 máximo **representable como `number`**: 2^63 − 1024.
 *
 * No alcanza con comparar contra 9223372036854775807: ese entero y el
 * 9223372036854776000 que llega son **el mismo double**, así que el `>` nunca
 * dispara y el clamp no clampea nada. Hay que bajar a un entero que un `number`
 * pueda expresar exacto y que siga entrando en un i64.
 */
// Escrito como expresión y no como literal a propósito: el valor es exacto
// —cerca de 2^63 los `number` avanzan de a 1024— pero JS lo IMPRIME como
// 9223372036854775000, y el linter marca esa diferencia como pérdida de
// precisión. `2 ** 63 - 1024` dice de dónde sale y no discute con nadie.
const I64_SAFE_MAX = 2 ** 63 - 1024;

/**
 * Kupmios con los cost models saneados.
 *
 * El devnet devuelve entradas de cost model con el valor máximo de i64
 * (9223372036854775807). Al pasar por JSON, JavaScript lo redondea a
 * 9223372036854776000 —un `number` no tiene 63 bits de mantisa— y CML lo
 * rechaza: `invalid value: integer 9223372036854776000, expected i64`.
 *
 * Es una fricción del devnet, no del diseño: **en Preprod los cost models
 * vienen dentro del rango y esta subclase no hace falta**, por eso vive en el
 * test y no en el adaptador.
 */
class KupmiosDevnet extends Kupmios {
  async getProtocolParameters() {
    const params = await super.getProtocolParameters();
    // Los cost models llegan como ARRAY de enteros por versión de Plutus;
    // convertirlos a objeto rompe con "costModels.PlutusV1 is not iterable".
    const clamp = (valor: number) => (valor >= I64_SAFE_MAX ? I64_SAFE_MAX : valor);
    const costModels = Object.fromEntries(
      Object.entries(params.costModels).map(([version, modelo]) => [
        version,
        Array.isArray(modelo)
          ? (modelo as number[]).map(clamp)
          : Object.fromEntries(
              Object.entries(modelo as Record<string, number>).map(([op, valor]) => [
                op,
                clamp(valor)
              ])
            )
      ])
    );
    return { ...params, costModels } as typeof params;
  }
}

/**
 * La configuración de slots del devnet, **derivada de la cadena**.
 *
 * Lucid necesita saber en qué momento real empezó el slot 0 para traducir
 * timestamps a slots, y en una red `Custom` no lo puede adivinar. Se calcula
 * desde el último bloque (`time - slot`) en vez de hardcodearse: el devnet
 * arranca de cero cada vez que se recrea, así que cualquier constante sería
 * mentira al segundo reinicio.
 */
async function slotConfigDelDevnet() {
  const res = await fetch(`${STORE_URL}/blocks/latest`);
  if (!res.ok) throw new Error(`yaci no responde en ${STORE_URL}: ¿levantaste el compose?`);
  const bloque = (await res.json()) as { time: number; slot: number };
  return {
    zeroTime: (bloque.time - bloque.slot) * 1000,
    zeroSlot: 0,
    slotLength: 1000
  };
}

/** El devnet hace un bloque por segundo; esperar es esperar de verdad. */
const esperarBloques = (n = 2) => new Promise((r) => setTimeout(r, n * 1500));

let adapter: LucidAnchorAdapter;

beforeAll(async () => {
  if (!corre) return;

  const seed = generateSeedPhrase();
  // **Kupmios (Kupo + Ogmios) y no Blockfrost**, aunque yaci exponga las dos.
  // El provider Blockfrost de Lucid 0.6 lee `cost_models_raw`, un campo que la
  // API de Blockfrost agregó después y que yaci-store todavía no devuelve: el
  // resultado es `Cannot read properties of undefined (reading 'PlutusV1')` al
  // construir Lucid. Ogmios entrega los parámetros de protocolo nativos y no
  // depende de esa forma. En Preprod se usa Blockfrost, que sí lo trae — y el
  // adaptador no se entera: recibe la instancia ya construida.
  const lucid = await Lucid(new KupmiosDevnet(KUPO_URL, OGMIOS_URL), "Custom", {
    slotConfig: await slotConfigDelDevnet()
  });
  lucid.selectWallet.fromSeed(seed);

  await topup(await lucid.wallet().address(), 10_000);
  await esperarBloques();

  adapter = await LucidAnchorAdapter.create({ lucid, network: "Custom" });
}, 60_000);

describe.skipIf(!corre)("AnchorPort contra un nodo Cardano local (yaci-devkit)", () => {
  it("abre el hilo, lo avanza y lo completa con el commitment", async () => {
    const pendiente = buildStageDatum(fuente);

    const abierto = await adapter.openThread({ datum: pendiente });
    await esperarBloques();
    expect((await adapter.verify(abierto.txid))?.datum.state).toBe("Pending");

    const enCurso = buildStageDatum({ ...fuente, state: "InProgress" });
    const avance = await adapter.advanceThread({
      outputRef: abierto.outputRef,
      previous: pendiente,
      next: enCurso
    });
    await esperarBloques();
    expect((await adapter.verify(avance.txid))?.datum.state).toBe("InProgress");

    const completo = buildStageDatum({
      ...fuente,
      state: "Completed",
      evidenceRoot: root,
      completedAt: Date.now()
    });
    const cierre = await adapter.advanceThread({
      outputRef: avance.outputRef,
      previous: enCurso,
      next: completo
    });
    await esperarBloques();

    const prueba = await adapter.verify(cierre.txid);
    expect(prueba?.datum.state).toBe("Completed");
    expect(prueba?.datum.evidenceRoot).toBe(root);
  }, 120_000);

  it("ancla el hash de una evidencia por metadata", async () => {
    const recibo = await adapter.anchorCommitment({
      sha256: "e".repeat(64),
      reference: "ev_yaci_1"
    });
    await esperarBloques();
    expect(recibo.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 60_000);

  it("el nodo rechaza lo que el validador rechaza", async () => {
    // Mismo rechazo que en el Emulator, pero con un nodo de verdad evaluando.
    const otro = { ...fuente, id: "clh3k9x0000008l3fyaci002" };
    const pendiente = buildStageDatum(otro);
    const abierto = await adapter.openThread({ datum: pendiente });
    await esperarBloques();

    await expect(
      adapter.advanceThread({
        outputRef: abierto.outputRef,
        previous: pendiente,
        next: buildStageDatum({
          ...otro,
          state: "Completed",
          evidenceRoot: root,
          completedAt: Date.now()
        })
      })
    ).rejects.toThrow();
  }, 120_000);
});
