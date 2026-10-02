import { generateSeedPhrase, Kupmios, Lucid } from "@lucid-evolution/lucid";
import { buildStageDatum } from "@plataforma/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { LucidAnchorAdapter } from "./real";

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

async function topup(address: string, ada: number): Promise<void> {
  const res = await fetch(`${ADMIN_URL}/local-cluster/api/addresses/topup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, adaAmount: ada })
  });
  if (!res.ok) throw new Error(`topup falló: ${res.status} ${await res.text()}`);
}

const I64_SAFE_MAX = 2 ** 63 - 1024;

class KupmiosDevnet extends Kupmios {
  async getProtocolParameters() {
    const params = await super.getProtocolParameters();
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

const esperarBloques = (n = 2) => new Promise((r) => setTimeout(r, n * 1500));

let adapter: LucidAnchorAdapter;
let lucid: Awaited<ReturnType<typeof Lucid>>;
let seed: string;

async function instanciaNueva(): Promise<LucidAnchorAdapter> {
  const otra = await Lucid(new KupmiosDevnet(KUPO_URL, OGMIOS_URL), "Custom", {
    slotConfig: await slotConfigDelDevnet()
  });
  otra.selectWallet.fromSeed(seed);
  return LucidAnchorAdapter.create({ lucid: otra, network: "Custom" });
}

beforeAll(async () => {
  if (!corre) return;

  seed = generateSeedPhrase();
  lucid = await Lucid(new KupmiosDevnet(KUPO_URL, OGMIOS_URL), "Custom", {
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

  it("encadena sin esperar el bloque: mints seguidos y un hilo de punta a punta", async () => {
    const fuentes = Array.from({ length: 5 }, (_, i) => ({
      ...fuente,
      id: `clh3k9x0000008l3fyacich${i}`
    }));

    const inicio = Date.now();
    const abiertos = [];
    for (const f of fuentes) {
      abiertos.push(await adapter.openThread({ datum: buildStageDatum(f) }));
    }

    const primero = fuentes[0]!;
    const pendiente = buildStageDatum(primero);
    const enCurso = buildStageDatum({ ...primero, state: "InProgress" });
    const avance = await adapter.advanceThread({
      outputRef: abiertos[0]!.outputRef,
      previous: pendiente,
      next: enCurso
    });
    const cierre = await adapter.advanceThread({
      outputRef: avance.outputRef,
      previous: enCurso,
      next: buildStageDatum({
        ...primero,
        state: "Completed",
        evidenceRoot: root,
        completedAt: Date.now()
      })
    });
    const enviados = Date.now() - inicio;

    await esperarBloques(4);

    for (const [i, abierto] of abiertos.slice(1).entries()) {
      expect((await adapter.verify(abierto.txid))?.datum.stageRef).toBe(
        buildStageDatum(fuentes[i + 1]!).stageRef
      );
    }
    expect((await adapter.verify(cierre.txid))?.datum.state).toBe("Completed");

    console.log(`[yaci] 7 transacciones encadenadas enviadas en ${enviados} ms`);
  }, 180_000);

  it("publica el reference script, lo descubre solo y el nodo evalúa el validador referenciado", async () => {
    const publicacion = await adapter.publishReferenceScript();
    await esperarBloques();
    expect(publicacion.txid).toMatch(/^[0-9a-f]{64}$/);

    const conRef = await LucidAnchorAdapter.create({ lucid, network: "Custom" });
    expect(conRef.referenceScriptOutputRef).toBe(publicacion.outputRef);

    expect((await conRef.publishReferenceScript()).txid).toBeNull();

    const suyo = { ...fuente, id: "clh3k9x0000008l3fyaciref" };
    const pendiente = buildStageDatum(suyo);
    const abierto = await conRef.openThread({ datum: pendiente });
    await esperarBloques();
    expect((await conRef.verify(abierto.txid))?.datum.state).toBe("Pending");

    const avance = await conRef.advanceThread({
      outputRef: abierto.outputRef,
      previous: pendiente,
      next: buildStageDatum({ ...suyo, state: "InProgress" })
    });
    await esperarBloques();
    expect((await conRef.verify(avance.txid))?.datum.state).toBe("InProgress");

    const utxos = await lucid.utxosAt(conRef.walletAddress);
    expect(utxos.filter((u) => u.scriptRef)).toHaveLength(1);
  }, 180_000);

  it("una instancia nueva no avanza un hilo cuya última tx no entró en un bloque", async () => {
    const otra = { ...fuente, id: "clh3k9x0000008l3fyacinew" };
    const pendiente = buildStageDatum(otra);
    const abierto = await adapter.openThread({ datum: pendiente });

    const nueva = await instanciaNueva();
    const avance = {
      outputRef: abierto.outputRef,
      previous: pendiente,
      next: buildStageDatum({ ...otra, state: "InProgress" })
    };
    await expect(nueva.advanceThread(avance)).rejects.toThrow(/No existe el UTxO/);

    await esperarBloques();
    const tarde = await nueva.advanceThread(avance);
    await esperarBloques();
    expect((await nueva.verify(tarde.txid))?.datum.state).toBe("InProgress");
  }, 180_000);
});
