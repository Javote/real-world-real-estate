import { generateEmulatorAccount, Lucid } from "@lucid-evolution/lucid";
import { Emulator } from "@lucid-evolution/provider";
import { buildStageDatum } from "@plataforma/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BLOCKFROST_TIMEOUT_MS,
  LucidAnchorAdapter,
  PENDING_UTXO_TTL_MS,
  THREAD_MIN_LOVELACE
} from "./real";

const fuente = {
  id: "clh3k9x0000008l3fstage01",
  projectId: "clh3k9x0000008l3fproj01",
  sequenceOrder: 1,
  validationCritical: true,
  state: "Pending" as const
};

const root = "a".repeat(64);

let emulator: Emulator;
let adapter: LucidAnchorAdapter;
let lucid: Awaited<ReturnType<typeof Lucid>>;
let desfase: number;

beforeEach(async () => {
  const cuenta = generateEmulatorAccount({ lovelace: 500_000_000n });
  emulator = new Emulator([cuenta]);
  desfase = 0;
  lucid = await Lucid(emulator, "Custom");
  lucid.selectWallet.fromSeed(cuenta.seedPhrase);
  adapter = await LucidAnchorAdapter.create({
    lucid,
    network: "Custom",
    now: () => emulator.now() + desfase
  });
});

async function abrirHilo(datum = buildStageDatum(fuente)) {
  const recibo = await adapter.openThread({ datum });
  emulator.awaitBlock(1);
  return recibo;
}

describe("openThread contra el validador real", () => {
  it("acuña el thread token y deja el hilo en Pending", async () => {
    const recibo = await abrirHilo();

    expect(recibo.txid).toMatch(/^[0-9a-f]{64}$/);
    const prueba = await adapter.verify(recibo.txid);
    expect(prueba?.datum.state).toBe("Pending");
    expect(prueba?.datum.stageRef).toBe(buildStageDatum(fuente).stageRef);
  });

  it("sin Blockfrost configurado, blockTimestamp es null — no el reloj del proceso", async () => {
    const recibo = await abrirHilo();
    const prueba = await adapter.verify(recibo.txid);
    expect(prueba?.blockTimestamp).toBeNull();
  });

  it("el script rechaza nacer fuera de Pending", async () => {
    await expect(
      adapter.openThread({ datum: buildStageDatum({ ...fuente, state: "InProgress" }) })
    ).rejects.toThrow(/failed script execution/);
  });

  it("el script rechaza nacer con evidencia ya puesta", async () => {
    await expect(
      adapter.openThread({ datum: buildStageDatum({ ...fuente, evidenceRoot: root }) })
    ).rejects.toThrow(/failed script execution/);
  });
});

describe("advanceThread contra el validador real", () => {
  it("mueve el hilo de Pending a InProgress", async () => {
    const abierto = await abrirHilo();
    const previous = buildStageDatum(fuente);
    const next = buildStageDatum({ ...fuente, state: "InProgress" });

    const avance = await adapter.advanceThread({
      outputRef: abierto.outputRef,
      previous,
      next
    });
    emulator.awaitBlock(1);

    const prueba = await adapter.verify(avance.txid);
    expect(prueba?.datum.state).toBe("InProgress");
    expect(avance.outputRef).not.toBe(abierto.outputRef);
  });

  it("el script rechaza una transición fuera de la tabla", async () => {
    const abierto = await abrirHilo();

    await expect(
      adapter.advanceThread({
        outputRef: abierto.outputRef,
        previous: buildStageDatum(fuente),
        next: buildStageDatum({
          ...fuente,
          state: "Completed",
          evidenceRoot: root,
          completedAt: emulator.now()
        })
      })
    ).rejects.toThrow(/failed script execution/);
  });

  it("el script rechaza completar un stage crítico sin commitment", async () => {
    const abierto = await abrirHilo();
    const enCurso = buildStageDatum({ ...fuente, state: "InProgress" });
    const paso = await adapter.advanceThread({
      outputRef: abierto.outputRef,
      previous: buildStageDatum(fuente),
      next: enCurso
    });
    emulator.awaitBlock(1);

    await expect(
      adapter.advanceThread({
        outputRef: paso.outputRef,
        previous: enCurso,
        next: buildStageDatum({ ...fuente, state: "Completed", completedAt: emulator.now() })
      })
    ).rejects.toThrow(/failed script execution/);
  });

  it("completa el stage crítico cuando el commitment está", async () => {
    const abierto = await abrirHilo();
    const enCurso = buildStageDatum({ ...fuente, state: "InProgress" });
    const paso = await adapter.advanceThread({
      outputRef: abierto.outputRef,
      previous: buildStageDatum(fuente),
      next: enCurso
    });
    emulator.awaitBlock(1);

    const completo = buildStageDatum({
      ...fuente,
      state: "Completed",
      evidenceRoot: root,
      completedAt: emulator.now()
    });
    const cierre = await adapter.advanceThread({
      outputRef: paso.outputRef,
      previous: enCurso,
      next: completo
    });
    emulator.awaitBlock(1);

    const prueba = await adapter.verify(cierre.txid);
    expect(prueba?.datum.state).toBe("Completed");
    expect(prueba?.datum.evidenceRoot).toBe(root);
  });

  it("el script rechaza salir del estado terminal", async () => {
    const abierto = await abrirHilo();
    const enCurso = buildStageDatum({ ...fuente, state: "InProgress" });
    const paso = await adapter.advanceThread({
      outputRef: abierto.outputRef,
      previous: buildStageDatum(fuente),
      next: enCurso
    });
    emulator.awaitBlock(1);

    const completo = buildStageDatum({
      ...fuente,
      state: "Completed",
      evidenceRoot: root,
      completedAt: emulator.now()
    });
    const cierre = await adapter.advanceThread({
      outputRef: paso.outputRef,
      previous: enCurso,
      next: completo
    });
    emulator.awaitBlock(1);

    await expect(
      adapter.advanceThread({
        outputRef: cierre.outputRef,
        previous: completo,
        next: buildStageDatum({
          ...fuente,
          state: "Observed",
          evidenceRoot: root,
          completedAt: completo.completedAt
        })
      })
    ).rejects.toThrow(/failed script execution/);
  });

  it.each([
    ["abc#xyz", "ni el hash ni el índice son válidos"],
    [`${"a".repeat(64)}#-1`, "índice negativo"],
    [`${"a".repeat(64)}#xyz`, "índice no numérico"],
    ["no-es-hex64#0", "hash mal formado"]
  ])("rechaza un outputRef mal formado (%s: %s) con BAD_OUTPUT_REF", async (outputRef) => {
    await expect(
      adapter.advanceThread({
        outputRef,
        previous: buildStageDatum(fuente),
        next: buildStageDatum({ ...fuente, state: "InProgress" })
      })
    ).rejects.toMatchObject({ code: "BAD_OUTPUT_REF" });
  });
});

describe("findLiveThread — Capa 1, contra el proveedor de verdad", () => {
  it("encuentra el UTxO vivo por stageRef, sin pasar por outputRef ni por verify()", async () => {
    const datum = buildStageDatum(fuente);
    const abierto = await abrirHilo(datum);

    const encontrado = await adapter.findLiveThread(datum.stageRef);

    expect(encontrado).toEqual({ outputRef: abierto.outputRef, datum });
  });

  it("sigue al hilo después de un advanceThread", async () => {
    const previous = buildStageDatum(fuente);
    const next = buildStageDatum({ ...fuente, state: "InProgress" });
    await abrirHilo(previous);
    const avance = await adapter.advanceThread({
      outputRef: (await adapter.findLiveThread(previous.stageRef))!.outputRef,
      previous,
      next
    });
    emulator.awaitBlock(1);

    const encontrado = await adapter.findLiveThread(previous.stageRef);

    expect(encontrado).toEqual({ outputRef: avance.outputRef, datum: next });
  });

  it("da null para un stage que nunca minteó", async () => {
    expect(await adapter.findLiveThread("stage-que-no-existe")).toBeNull();
  });

  it("un UTxO de otro stage en la misma dirección no lo confunde: no lleva el unit buscado", async () => {
    await abrirHilo();
    expect(await adapter.findLiveThread("stage-que-tampoco-existe")).toBeNull();
  });
});

describe("la dirección y la policy", () => {
  it("salen del blueprint y del admin de la wallet, no de configuración", async () => {
    expect(adapter.address.startsWith("addr_test1")).toBe(true);
    expect(adapter.policyId).toMatch(/^[0-9a-f]{56}$/);
  });
});

describe("create — defaults", () => {
  it("sin `now` explícito, usa Date.now() del proceso", async () => {
    const sinNow = await LucidAnchorAdapter.create({ lucid, network: "Custom" });
    const recibo = await sinNow.anchorCommitment({
      sha256: "d".repeat(64),
      reference: "ev_default_now"
    });
    expect(recibo.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("anchorEvidence · el camino de metadata (D-006)", () => {
  const sha256 = "b".repeat(64);

  it("ancla el hash sin tocar el hilo ni el thread token", async () => {
    const recibo = await adapter.anchorCommitment({ sha256, reference: "ev_123" });
    emulator.awaitBlock(1);

    expect(recibo.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await adapter.verify(recibo.txid)).toBeNull();
  });

  it("rechaza lo que no sea un SHA-256", async () => {
    await expect(adapter.anchorCommitment({ sha256: "corto", reference: "ev" })).rejects.toThrow(
      /SHA-256/
    );
  });

  it("rechaza una ref que no entre en un string de metadata", async () => {
    await expect(adapter.anchorCommitment({ sha256, reference: "x".repeat(65) })).rejects.toThrow(
      /no entra/
    );
  });
});

describe("confirmedAt — timeout contra Blockfrost", () => {
  it(
    "rechaza al vencer el timeout, en vez de esperar para siempre",
    async () => {
      const fetchQueColgado = vi.fn(
        (_url: string, opts: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener("abort", () =>
              reject(new DOMException("The operation was aborted", "AbortError"))
            );
          })
      );
      vi.stubGlobal("fetch", fetchQueColgado);

      try {
        const conBlockfrost = await LucidAnchorAdapter.create({
          lucid,
          network: "Custom",
          now: () => emulator.now(),
          blockfrost: { url: "https://cardano-preprod.blockfrost.io/api/v0", apiKey: "k" }
        });

        await expect(conBlockfrost.confirmedAt("a".repeat(64))).rejects.toThrow(/no contestó/);
        expect(fetchQueColgado).toHaveBeenCalledOnce();
      } finally {
        vi.unstubAllGlobals();
      }
    },
    BLOCKFROST_TIMEOUT_MS + 5_000
  );

  it("con 404 sigue dando null, como antes del timeout", async () => {
    const fetchQueContesta404 = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchQueContesta404);

    try {
      const conBlockfrost = await LucidAnchorAdapter.create({
        lucid,
        network: "Custom",
        now: () => emulator.now(),
        blockfrost: { url: "https://cardano-preprod.blockfrost.io/api/v0", apiKey: "k" }
      });

      expect(await conBlockfrost.confirmedAt("a".repeat(64))).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("con 200 y block_time, confirmedAt lo pasa a milisegundos", async () => {
    const fetchQueContesta200 = vi.fn(
      async () => new Response(JSON.stringify({ block_time: 1_700_000_000 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchQueContesta200);

    try {
      const conBlockfrost = await LucidAnchorAdapter.create({
        lucid,
        network: "Custom",
        now: () => emulator.now(),
        blockfrost: { url: "https://cardano-preprod.blockfrost.io/api/v0", apiKey: "k" }
      });

      expect(await conBlockfrost.confirmedAt("a".repeat(64))).toBe(1_700_000_000_000);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("con 200 pero sin block_time numérico, da null en vez de NaN", async () => {
    const fetchSinBlockTime = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchSinBlockTime);

    try {
      const conBlockfrost = await LucidAnchorAdapter.create({
        lucid,
        network: "Custom",
        now: () => emulator.now(),
        blockfrost: { url: "https://cardano-preprod.blockfrost.io/api/v0", apiKey: "k" }
      });

      expect(await conBlockfrost.confirmedAt("a".repeat(64))).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("un error de verdad de Blockfrost (no 404) se propaga, no se confunde con 'no confirmó'", async () => {
    const fetchQueContesta500 = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchQueContesta500);

    try {
      const conBlockfrost = await LucidAnchorAdapter.create({
        lucid,
        network: "Custom",
        now: () => emulator.now(),
        blockfrost: { url: "https://cardano-preprod.blockfrost.io/api/v0", apiKey: "k" }
      });

      await expect(conBlockfrost.confirmedAt("a".repeat(64))).rejects.toThrow(
        /Blockfrost respondió 500/
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("awaitConfirmation", () => {
  it("devuelve el AnchorProof cuando el hilo confirmó", async () => {
    const recibo = await abrirHilo();
    expect(await adapter.awaitConfirmation(recibo.txid)).toMatchObject({ txid: recibo.txid });
  });

  it("verify() da null sin construir el proof, si el proveedor todavía no confirmó", async () => {
    const noConfirmo = vi.spyOn(lucid, "awaitTx").mockResolvedValue(false);
    try {
      expect(await adapter.verify("f".repeat(64))).toBeNull();
    } finally {
      noConfirmo.mockRestore();
    }
  });

  it("rechaza si verify() no encuentra un AnchorProof", async () => {
    const sinProof = vi.spyOn(adapter, "verify").mockResolvedValue(null);
    try {
      await expect(adapter.awaitConfirmation("f".repeat(64))).rejects.toThrow(/no confirmó/);
    } finally {
      sinProof.mockRestore();
    }
  });
});

describe("dos anclajes dentro del mismo bloque", () => {
  const unHash = "a".repeat(64);
  const otroHash = "b".repeat(64);

  it("el segundo no se arma contra el UTxO que gastó el primero", async () => {
    const primero = await adapter.anchorCommitment({ sha256: unHash, reference: "ev_1" });
    const segundo = await adapter.anchorCommitment({ sha256: otroHash, reference: "ev_2" });

    expect(segundo.txid).not.toBe(primero.txid);

    emulator.awaitBlock(1);
    const enLaWallet = await emulator.getUtxos(adapter.walletAddress);
    expect(enLaWallet.map((u) => u.txHash)).toContain(segundo.txid);
  });

  it("aguantan pedidos concurrentes, que es lo que la cola resuelve", async () => {
    const [primero, segundo] = await Promise.all([
      adapter.anchorCommitment({ sha256: unHash, reference: "ev_1" }),
      adapter.anchorCommitment({ sha256: otroHash, reference: "ev_2" })
    ]);

    expect(primero.txid).not.toBe(segundo.txid);
  });

  it("un anclaje que falla no arrastra al siguiente", async () => {
    await expect(
      adapter.openThread({ datum: buildStageDatum({ ...fuente, state: "InProgress" }) })
    ).rejects.toThrow(/failed script execution/);

    const recibo = await adapter.anchorCommitment({ sha256: unHash, reference: "ev_1" });
    expect(recibo.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el hilo avanza sin esperar a que el bloque lo publique", async () => {
    const abierto = await adapter.openThread({ datum: buildStageDatum(fuente) });
    const avance = await adapter.advanceThread({
      outputRef: abierto.outputRef,
      previous: buildStageDatum(fuente),
      next: buildStageDatum({ ...fuente, state: "InProgress" })
    });
    emulator.awaitBlock(1);

    const prueba = await adapter.verify(avance.txid);
    expect(prueba?.datum.state).toBe("InProgress");
  });

  it("el hilo ya gastado deja de estar disponible", async () => {
    const abierto = await adapter.openThread({ datum: buildStageDatum(fuente) });
    const enCurso = buildStageDatum({ ...fuente, state: "InProgress" });
    await adapter.advanceThread({
      outputRef: abierto.outputRef,
      previous: buildStageDatum(fuente),
      next: enCurso
    });

    await expect(
      adapter.advanceThread({
        outputRef: abierto.outputRef,
        previous: buildStageDatum(fuente),
        next: enCurso
      })
    ).rejects.toThrow(/No existe el UTxO/);
  });

  it("un adaptador nuevo encuentra un UTxO que él nunca envió, vía el proveedor", async () => {
    const abierto = await adapter.openThread({ datum: buildStageDatum(fuente) });
    emulator.awaitBlock(1);

    const otroAdaptador = await LucidAnchorAdapter.create({
      lucid,
      network: "Custom",
      now: () => emulator.now()
    });

    const avance = await otroAdaptador.advanceThread({
      outputRef: abierto.outputRef,
      previous: buildStageDatum(fuente),
      next: buildStageDatum({ ...fuente, state: "InProgress" })
    });
    expect(avance.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("la vista local vence", () => {
  it("contesta mientras vale y le devuelve la palabra a la cadena cuando no", async () => {
    const primero = await adapter.openThread({ datum: buildStageDatum(fuente) });
    const avance = await adapter.advanceThread({
      outputRef: primero.outputRef,
      previous: buildStageDatum(fuente),
      next: buildStageDatum({ ...fuente, state: "InProgress" })
    });
    expect(avance.txid).toMatch(/^[0-9a-f]{64}$/);

    const otro = { ...fuente, id: "clh3k9x0000008l3fstage02" };
    const segundo = await adapter.openThread({ datum: buildStageDatum(otro) });

    desfase = PENDING_UTXO_TTL_MS;

    await expect(
      adapter.advanceThread({
        outputRef: segundo.outputRef,
        previous: buildStageDatum(otro),
        next: buildStageDatum({ ...otro, state: "InProgress" })
      })
    ).rejects.toThrow(/No existe el UTxO/);
  });
});

async function saldo(address: string, emu: Emulator): Promise<bigint> {
  const utxos = await emu.getUtxos(address);
  return utxos.reduce((total, u) => total + (u.assets.lovelace ?? 0n), 0n);
}

async function feeDeAbrirHilo(a: LucidAnchorAdapter, emu: Emulator): Promise<bigint> {
  const antes = await saldo(a.walletAddress, emu);
  await a.openThread({ datum: buildStageDatum(fuente) });
  emu.awaitBlock(1);
  const despues = await saldo(a.walletAddress, emu);
  return antes - despues - THREAD_MIN_LOVELACE;
}

describe("el reference script", () => {
  it("referenceScriptOutputRef es null antes de publicar nada", () => {
    expect(adapter.referenceScriptOutputRef).toBeNull();
  });

  it("se publica, se descubre solo y no se publica dos veces", async () => {
    const publicacion = await adapter.publishReferenceScript();
    emulator.awaitBlock(1);

    expect(publicacion.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(publicacion.outputRef).toBe(adapter.referenceScriptOutputRef);
    expect(publicacion.lovelace).toBeGreaterThan(0n);

    const otro = await LucidAnchorAdapter.create({
      lucid,
      network: "Custom",
      now: () => emulator.now()
    });
    expect(otro.referenceScriptOutputRef).toBe(publicacion.outputRef);

    const otraVez = await otro.publishReferenceScript();
    expect(otraVez.txid).toBeNull();
    expect(otraVez.outputRef).toBe(publicacion.outputRef);
  });

  it("tira si el proveedor no dejó ninguna salida con el script adentro", async () => {
    const espia = vi
      .spyOn(adapter as unknown as { enviar: (tx: unknown) => Promise<unknown> }, "enviar")
      .mockResolvedValueOnce({
        txid: "f".repeat(64),
        outputRef: `${"f".repeat(64)}#0`,
        status: "Pending",
        salidas: []
      });

    try {
      await expect(adapter.publishReferenceScript()).rejects.toThrow(
        /no dejó ninguna salida con el validador adentro/
      );
    } finally {
      espia.mockRestore();
    }
  });

  it("el validador se sigue ejecutando, referenciado en vez de adjunto", async () => {
    await adapter.publishReferenceScript();
    emulator.awaitBlock(1);

    const abierto = await adapter.openThread({ datum: buildStageDatum(fuente) });
    const avance = await adapter.advanceThread({
      outputRef: abierto.outputRef,
      previous: buildStageDatum(fuente),
      next: buildStageDatum({ ...fuente, state: "InProgress" })
    });
    emulator.awaitBlock(1);

    expect((await adapter.verify(avance.txid))?.datum.state).toBe("InProgress");

    await expect(
      adapter.openThread({ datum: buildStageDatum({ ...fuente, state: "InProgress" }) })
    ).rejects.toThrow(/failed script execution/);
  });

  it("no se lo come la selección de monedas cuando la wallet queda corta", async () => {
    const cuenta = generateEmulatorAccount({ lovelace: 12_400_000n });
    const pobre = new Emulator([cuenta]);
    const suLucid = await Lucid(pobre, "Custom");
    suLucid.selectWallet.fromSeed(cuenta.seedPhrase);
    const suAdapter = await LucidAnchorAdapter.create({
      lucid: suLucid,
      network: "Custom",
      now: () => pobre.now()
    });

    await suAdapter.publishReferenceScript();
    pobre.awaitBlock(1);

    await expect(
      suAdapter.anchorCommitment({ sha256: "c".repeat(64), reference: "ev_1" })
    ).rejects.toThrow(/enough funds/);

    const quedan = await pobre.getUtxos(suAdapter.walletAddress);
    expect(quedan.filter((u) => u.scriptRef)).toHaveLength(1);
  });

  it("abarata la transacción, que es la única razón por la que existe", async () => {
    const conAttach = await feeDeAbrirHilo(adapter, emulator);

    const cuenta = generateEmulatorAccount({ lovelace: 500_000_000n });
    const otroEmulator = new Emulator([cuenta]);
    const otroLucid = await Lucid(otroEmulator, "Custom");
    otroLucid.selectWallet.fromSeed(cuenta.seedPhrase);
    const conRef = await LucidAnchorAdapter.create({
      lucid: otroLucid,
      network: "Custom",
      now: () => otroEmulator.now()
    });
    await conRef.publishReferenceScript();
    otroEmulator.awaitBlock(1);

    const feeConRef = await feeDeAbrirHilo(conRef, otroEmulator);

    expect(feeConRef).toBeLessThan(conAttach - 30_000n);
  });
});
