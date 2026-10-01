import { buildStageDatum } from "@plataforma/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnchorPort } from "./factory";
import { InMemoryLedgerStore } from "./ledger";
import { AnchorRejectedError } from "./port";
import { canonical, SimulatedAnchorAdapter } from "./simulated";

const fuente = {
  id: "clh3k9x0000008l3fstage01",
  projectId: "clh3k9x0000008l3fproj01",
  sequenceOrder: 1,
  validationCritical: false,
  state: "Pending" as const
};

const root = "a".repeat(64);

let port: SimulatedAnchorAdapter;

beforeEach(() => {
  port = new SimulatedAnchorAdapter({ store: new InMemoryLedgerStore(), now: () => 1_700_000_000 });
});

describe("openThread · el mint", () => {
  it("abre el hilo y devuelve el UTxO vivo", async () => {
    const recibo = await port.openThread({ datum: buildStageDatum(fuente) });
    expect(recibo.status).toBe("Pending");
    expect(recibo.outputRef).toBe(`${recibo.txid}#0`);
    expect(await port.verify(recibo.txid)).toMatchObject({ outputRef: recibo.outputRef });
  });

  it("rechaza un segundo hilo para el mismo stage", async () => {
    const datum = buildStageDatum(fuente);
    await port.openThread({ datum });
    await expect(port.openThread({ datum })).rejects.toMatchObject({
      code: "THREAD_ALREADY_OPEN"
    });
  });

  it("rechaza nacer fuera de Pending o con evidencia ya puesta", async () => {
    await expect(
      port.openThread({ datum: buildStageDatum({ ...fuente, state: "InProgress" }) })
    ).rejects.toMatchObject({ code: "INVALID_INITIAL_DATUM" });

    await expect(
      port.openThread({ datum: buildStageDatum({ ...fuente, evidenceRoot: root }) })
    ).rejects.toMatchObject({ code: "INVALID_INITIAL_DATUM" });
  });

  it("es determinístico: el mismo datum da el mismo txid", async () => {
    const otro = new SimulatedAnchorAdapter({ store: new InMemoryLedgerStore() });
    const a = await port.openThread({ datum: buildStageDatum(fuente) });
    const b = await otro.openThread({ datum: buildStageDatum(fuente) });
    expect(a.txid).toBe(b.txid);
  });

  it("el txid no se mueve por haber ordenado canonical() por clave", async () => {
    const recibo = await port.openThread({ datum: buildStageDatum(fuente) });
    expect(recibo.txid).toBe("0d22fc2dceaf2a6ccfb64046f07b43df10ab7932502ab791ec31467f953d1ea4");
  });
});

describe("canonical — ordena por clave, no por el par [clave, valor]", () => {
  it("con una clave prefijo de otra, la más corta va primero", () => {
    expect(canonical({ "a!b": 1, a: 2 })).toBe(canonical({ a: 2, "a!b": 1 }));
    expect(canonical({ "a!b": 1, a: 2 })).toBe('{"a":2,"a!b":1}');
  });

  it("un StageDatum canonicaliza igual sea cual sea el orden de sus campos", () => {
    const datum = buildStageDatum(fuente);
    const reordenado = {
      state: datum.state,
      stageRef: datum.stageRef,
      completedAt: datum.completedAt,
      evidenceRoot: datum.evidenceRoot,
      projectRef: datum.projectRef,
      sequenceOrder: datum.sequenceOrder,
      validationCritical: datum.validationCritical
    };
    expect(canonical(datum)).toBe(canonical(reordenado));
  });
});

describe("advanceThread · el spend", () => {
  const pending = buildStageDatum(fuente);
  const inProgress = buildStageDatum({ ...fuente, state: "InProgress" });

  it("avanza el hilo y deja el UTxO nuevo vivo", async () => {
    const abierto = await port.openThread({ datum: pending });
    const avanzado = await port.advanceThread({
      outputRef: abierto.outputRef,
      previous: pending,
      next: inProgress
    });

    expect(avanzado.outputRef).not.toBe(abierto.outputRef);
    const prueba = await port.verify(avanzado.txid);
    expect(prueba?.datum.state).toBe("InProgress");
  });

  it("rechaza gastar dos veces el mismo UTxO", async () => {
    const abierto = await port.openThread({ datum: pending });
    await port.advanceThread({ outputRef: abierto.outputRef, previous: pending, next: inProgress });

    await expect(
      port.advanceThread({ outputRef: abierto.outputRef, previous: pending, next: inProgress })
    ).rejects.toMatchObject({ code: "THREAD_ALREADY_SPENT" });
  });

  it("rechaza un UTxO que no existe", async () => {
    await expect(
      port.advanceThread({ outputRef: `${"0".repeat(64)}#0`, previous: pending, next: inProgress })
    ).rejects.toMatchObject({ code: "UNKNOWN_THREAD" });
  });

  it("rechaza si el datum que se declara no es el que tiene el hilo", async () => {
    const abierto = await port.openThread({ datum: pending });
    await expect(
      port.advanceThread({
        outputRef: abierto.outputRef,
        previous: inProgress,
        next: buildStageDatum({ ...fuente, state: "Completed", completedAt: 5 })
      })
    ).rejects.toMatchObject({ code: "STALE_DATUM" });
  });

  it("rechaza una transición fuera de la tabla", async () => {
    const abierto = await port.openThread({ datum: pending });
    await expect(
      port.advanceThread({
        outputRef: abierto.outputRef,
        previous: pending,
        next: buildStageDatum({ ...fuente, state: "Completed", completedAt: 5 })
      })
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("rechaza reescribir la identidad del stage", async () => {
    const abierto = await port.openThread({ datum: pending });
    await expect(
      port.advanceThread({
        outputRef: abierto.outputRef,
        previous: pending,
        next: buildStageDatum({ ...fuente, state: "InProgress", sequenceOrder: 9 })
      })
    ).rejects.toMatchObject({ code: "IDENTITY_REWRITTEN" });
  });

  it("rechaza completar un stage crítico sin commitment de evidencia", async () => {
    const critico = { ...fuente, validationCritical: true };
    const abierto = await port.openThread({ datum: buildStageDatum(critico) });
    const enCurso = buildStageDatum({ ...critico, state: "InProgress" });
    const paso = await port.advanceThread({
      outputRef: abierto.outputRef,
      previous: buildStageDatum(critico),
      next: enCurso
    });

    await expect(
      port.advanceThread({
        outputRef: paso.outputRef,
        previous: enCurso,
        next: buildStageDatum({ ...critico, state: "Completed", completedAt: 5 })
      })
    ).rejects.toMatchObject({ code: "EVIDENCE_REQUIRED" });

    const completo = await port.advanceThread({
      outputRef: paso.outputRef,
      previous: enCurso,
      next: buildStageDatum({
        ...critico,
        state: "Completed",
        evidenceRoot: root,
        completedAt: 5
      })
    });
    expect(completo.status).toBe("Pending");
  });

  it("los rechazos son AnchorRejectedError, no fallos de infraestructura", async () => {
    await expect(
      port.advanceThread({ outputRef: "no-existe#0", previous: pending, next: inProgress })
    ).rejects.toBeInstanceOf(AnchorRejectedError);
  });
});

describe("findLiveThread — Capa 1, reconciliación sin registro", () => {
  it("devuelve el UTxO vivo por stageRef, no por el registro de eventos", async () => {
    const datum = buildStageDatum(fuente);
    const abierto = await port.openThread({ datum });

    const encontrado = await port.findLiveThread(datum.stageRef);

    expect(encontrado).toEqual({ outputRef: abierto.outputRef, datum });
  });

  it("sigue al hilo después de un advanceThread — el UTxO viejo ya no es el vivo", async () => {
    const pending = buildStageDatum(fuente);
    const inProgress = buildStageDatum({ ...fuente, state: "InProgress" });
    const abierto = await port.openThread({ datum: pending });
    const avanzado = await port.advanceThread({
      outputRef: abierto.outputRef,
      previous: pending,
      next: inProgress
    });

    const encontrado = await port.findLiveThread(pending.stageRef);

    expect(encontrado).toEqual({ outputRef: avanzado.outputRef, datum: inProgress });
  });

  it("da null para un stage que nunca minteó", async () => {
    expect(await port.findLiveThread("stage-que-no-existe")).toBeNull();
  });
});

describe("createAnchorPort", () => {
  it("por defecto es simulated", async () => {
    expect((await createAnchorPort({})).mode).toBe("simulated");
  });

  it("modo simulated con un store explícito lo usa en vez del default en memoria", async () => {
    const store = new InMemoryLedgerStore();
    const puerto = (await createAnchorPort({ store })) as SimulatedAnchorAdapter;
    const recibo = await puerto.openThread({ datum: buildStageDatum(fuente) });

    expect(await store.get(recibo.outputRef)).not.toBeUndefined();
  });

  it("revienta con un modo inventado", async () => {
    await expect(createAnchorPort({ mode: "mainnet" })).rejects.toThrow(/ANCHOR_MODE inválido/);
  });

  it("rechaza mainnet, que está fuera de alcance", async () => {
    await expect(
      createAnchorPort({
        mode: "real",
        network: "Mainnet",
        blockfrostApiKey: "k",
        privateKey: "s"
      })
    ).rejects.toThrow(/Mainnet está fuera de alcance/);
  });

  it("exige BLOCKFROST_API_KEY", async () => {
    await expect(createAnchorPort({ mode: "real", privateKey: "s" })).rejects.toThrow(
      /exige BLOCKFROST_API_KEY/
    );
  });

  it("exige SERVICE_WALLET_PRIVATE_KEY", async () => {
    await expect(createAnchorPort({ mode: "real", blockfrostApiKey: "k" })).rejects.toThrow(
      /exige SERVICE_WALLET_PRIVATE_KEY/
    );
  });

  it("una variable en blanco cuenta como ausente, no como valor", async () => {
    await expect(
      createAnchorPort({ mode: "real", blockfrostApiKey: "  ", privateKey: "s" })
    ).rejects.toThrow(/exige BLOCKFROST_API_KEY/);
  });
});

describe("anchorEvidence · el camino de metadata", () => {
  it("es determinístico y no toca el ledger del hilo", async () => {
    const sha256 = "c".repeat(64);
    const a = await port.anchorCommitment({ sha256, reference: "ev_1" });
    const b = await port.anchorCommitment({ sha256, reference: "ev_1" });
    expect(a.txid).toBe(b.txid);
    expect(a.status).toBe("Pending");
  });

  it("rechaza un hash que no sea SHA-256", async () => {
    await expect(port.anchorCommitment({ sha256: "corto", reference: "ev" })).rejects.toMatchObject(
      {
        code: "BAD_EVIDENCE_HASH"
      }
    );
  });
});

describe("verify — condición defensiva", () => {
  it("da null si el UTxO está en el store pero su bloque nunca se registró", async () => {
    const store = new InMemoryLedgerStore();
    const puerto = new SimulatedAnchorAdapter({ store });
    const txid = "e".repeat(64);
    await store.put({
      outputRef: `${txid}#0`,
      assetName: "asset1",
      datum: buildStageDatum(fuente),
      spentByTxid: null
    });

    expect(await puerto.verify(txid)).toBeNull();
  });
});

describe("confirmedAt", () => {
  it("devuelve null para un txid que no produjo", async () => {
    const puerto = new SimulatedAnchorAdapter();

    expect(await puerto.confirmedAt("f".repeat(64))).toBeNull();
  });

  it("awaitConfirmation rechaza para un txid que no produjo, en vez de devolver null", async () => {
    const puerto = new SimulatedAnchorAdapter();

    await expect(puerto.awaitConfirmation("f".repeat(64))).rejects.toThrow(AnchorRejectedError);
  });

  it("awaitConfirmation devuelve el AnchorProof cuando el hilo existe", async () => {
    const puerto = new SimulatedAnchorAdapter();
    const { txid } = await puerto.openThread({ datum: buildStageDatum(fuente) });

    expect(await puerto.awaitConfirmation(txid)).toMatchObject({ txid });
  });

  it("confirma un anclaje por metadata, que no deja AnchorProof", async () => {
    const puerto = new SimulatedAnchorAdapter();
    const { txid } = await puerto.anchorCommitment({
      sha256: "a".repeat(64),
      reference: "ref-opaca"
    });

    expect(await puerto.verify(txid)).toBeNull();
    expect(await puerto.confirmedAt(txid)).toEqual(expect.any(Number));
  });

  it("confirma un anclaje con hilo", async () => {
    const puerto = new SimulatedAnchorAdapter();
    const { txid } = await puerto.openThread({ datum: buildStageDatum(fuente) });

    expect(await puerto.confirmedAt(txid)).toEqual(expect.any(Number));
  });

  it("el momento de inclusión no se mueve al reintentar el mismo anclaje", async () => {
    let reloj = 1_000;
    const puerto = new SimulatedAnchorAdapter({ now: () => reloj });
    const entrada = { sha256: "b".repeat(64), reference: "ref" };

    const primero = await puerto.anchorCommitment(entrada);
    const cuando = await puerto.confirmedAt(primero.txid);

    reloj = 99_000;
    const segundo = await puerto.anchorCommitment(entrada);

    expect(segundo.txid).toBe(primero.txid);
    expect(await puerto.confirmedAt(segundo.txid)).toBe(cuando);
  });
});

describe("sobrevive a un reinicio del proceso — mismo store, instancia nueva", () => {
  it("confirmedAt de un hilo sigue siendo el mismo número", async () => {
    const store = new InMemoryLedgerStore();
    const antes = new SimulatedAnchorAdapter({ store, now: () => 1_234 });
    const { txid } = await antes.openThread({ datum: buildStageDatum(fuente) });

    const despues = new SimulatedAnchorAdapter({ store });
    expect(await despues.confirmedAt(txid)).toBe(1_234);
  });

  it("verify de un hilo sigue devolviendo el mismo AnchorProof", async () => {
    const store = new InMemoryLedgerStore();
    const antes = new SimulatedAnchorAdapter({ store, now: () => 5_555 });
    const abierto = await antes.openThread({ datum: buildStageDatum(fuente) });

    const despues = new SimulatedAnchorAdapter({ store });
    expect(await despues.verify(abierto.txid)).toEqual({
      txid: abierto.txid,
      outputRef: abierto.outputRef,
      blockTimestamp: 5_555,
      datum: buildStageDatum(fuente)
    });
  });

  it("confirmedAt de un anclaje por metadata (sin hilo) sigue siendo el mismo número", async () => {
    const store = new InMemoryLedgerStore();
    const antes = new SimulatedAnchorAdapter({ store, now: () => 7_777 });
    const { txid } = await antes.anchorCommitment({ sha256: "d".repeat(64), reference: "ref" });

    const despues = new SimulatedAnchorAdapter({ store });
    expect(await despues.confirmedAt(txid)).toBe(7_777);
  });

  it("un txid que nunca se ancló sigue dando null", async () => {
    const store = new InMemoryLedgerStore();
    await store.registrarBloque("otro-txid", 1);

    const despues = new SimulatedAnchorAdapter({ store });
    expect(await despues.confirmedAt("f".repeat(64))).toBeNull();
  });

  it("re-anclar el mismo archivo después del reinicio da el mismo txid y el mismo timestamp", async () => {
    const store = new InMemoryLedgerStore();
    const entrada = { sha256: "e".repeat(64), reference: "ref-reinicio" };
    const antes = new SimulatedAnchorAdapter({ store, now: () => 1_000 });
    const primero = await antes.anchorCommitment(entrada);

    const despues = new SimulatedAnchorAdapter({ store, now: () => 9_999 });
    const segundo = await despues.anchorCommitment(entrada);

    expect(segundo.txid).toBe(primero.txid);
    expect(await despues.confirmedAt(segundo.txid)).toBe(1_000);
  });

  it("advanceThread sigue funcionando después del reinicio", async () => {
    const store = new InMemoryLedgerStore();
    const pending = buildStageDatum(fuente);
    const inProgress = buildStageDatum({ ...fuente, state: "InProgress" });
    const antes = new SimulatedAnchorAdapter({ store });
    const abierto = await antes.openThread({ datum: pending });

    const despues = new SimulatedAnchorAdapter({ store });
    const avanzado = await despues.advanceThread({
      outputRef: abierto.outputRef,
      previous: pending,
      next: inProgress
    });

    expect(avanzado.status).toBe("Pending");
    expect((await despues.verify(avanzado.txid))?.datum.state).toBe("InProgress");
  });
});
