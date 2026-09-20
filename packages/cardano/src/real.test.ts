import { generateEmulatorAccount, Lucid } from "@lucid-evolution/lucid";
import { Emulator } from "@lucid-evolution/provider";
import { buildStageDatum } from "@plataforma/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { LucidAnchorAdapter, PENDING_UTXO_TTL_MS, THREAD_MIN_LOVELACE } from "./real";

// SPEC-013 §B. **Acá el validador se ejecuta de verdad**: el `Emulator` de
// Lucid evalúa el script Plutus compilado por Aiken, así que un rechazo de este
// archivo es el mismo rechazo que daría la cadena — sin Docker, sin red, sin
// una sola tADA.
//
// Es lo que convierte "el códec compila" en "la transacción entra".
//
// Los rechazos exigen `/failed script execution/` a propósito: un
// `toThrow()` pelado pasaría también si la transacción fallara por una razón
// nuestra —un UTxO que no está, plata que no alcanza— y el test diría que el
// validador rechazó algo que nunca llegó a evaluar.

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
/** La misma instancia que tiene el adaptador: los tests que arman un segundo
 * adaptador sobre la misma wallet la necesitan. */
let lucid: Awaited<ReturnType<typeof Lucid>>;
/**
 * Cuánto se le suma al reloj del `Emulator`. Los tests de la vista local lo
 * mueven para vencerla sin esperar tres minutos de verdad.
 */
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

/** Abre el hilo y espera el bloque, que es lo que hace visible el UTxO. */
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

  // SPEC-409 — sin Blockfrost configurado (el caso del `Emulator`, de este
  // `describe` entero), `verify()` no puede afirmar el timestamp del bloque:
  // antes devolvía el reloj del proceso, que no es el del bloque.
  it("sin Blockfrost configurado, blockTimestamp es null — no el reloj del proceso", async () => {
    const recibo = await abrirHilo();
    const prueba = await adapter.verify(recibo.txid);
    expect(prueba?.blockTimestamp).toBeNull();
  });

  it("el script rechaza nacer fuera de Pending", async () => {
    // `mint_rejects_starting_outside_pending`, pero ejecutado de verdad: el
    // error sale de la evaluación del script, no de una regla nuestra.
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
    // La regla del whitepaper, ejecutándose: sin Merkle root de 32 bytes, un
    // stage validation-critical no llega a Completed. Ni con la firma correcta.
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
});

describe("la dirección y la policy", () => {
  it("salen del blueprint y del admin de la wallet, no de configuración", async () => {
    expect(adapter.address.startsWith("addr_test1")).toBe(true);
    expect(adapter.policyId).toMatch(/^[0-9a-f]{56}$/);
  });
});

describe("anchorEvidence · el camino de metadata (D-006)", () => {
  const sha256 = "b".repeat(64);

  it("ancla el hash sin tocar el hilo ni el thread token", async () => {
    // Es el otro componente on-chain de M1: prueba que el archivo existía a
    // esta hora, no que un stage avanzó. No pasa por ningún validador.
    const recibo = await adapter.anchorCommitment({ sha256, reference: "ev_123" });
    emulator.awaitBlock(1);

    expect(recibo.txid).toMatch(/^[0-9a-f]{64}$/);
    // No quedó ningún UTxO nuevo en la dirección del script.
    expect(await adapter.verify(recibo.txid)).toBeNull();
  });

  it("rechaza lo que no sea un SHA-256", async () => {
    await expect(adapter.anchorCommitment({ sha256: "corto", reference: "ev" })).rejects.toThrow(
      /SHA-256/
    );
  });

  it("rechaza una ref que no entre en un string de metadata", async () => {
    // 64 bytes es el tope de una cadena de metadata (regla 2).
    await expect(adapter.anchorCommitment({ sha256, reference: "x".repeat(65) })).rejects.toThrow(
      /no entra/
    );
  });
});

// ── La cola y la vista local ────────────────────────────────────────────────
//
// **El `Emulator` reproduce el bug exacto de Preprod**, y por eso estos tests
// prueban algo: `getUtxos()` lee solo el ledger —lo que entró en un bloque— y
// deja el mempool afuera, igual que Blockfrost. Un anclaje sin
// `emulator.awaitBlock()` detrás es un anclaje contra un proveedor que todavía
// no vio el anterior; que es la condición que se da en producción cada vez que
// dos anclajes caen dentro de los ~20 s que tarda un bloque.
//
// Sin el arreglo, el primero de estos tests muere en `Your wallet does not have
// enough funds` y el segundo en `UNKNOWN_THREAD`.

describe("dos anclajes dentro del mismo bloque", () => {
  const unHash = "a".repeat(64);
  const otroHash = "b".repeat(64);

  it("el segundo no se arma contra el UTxO que gastó el primero", async () => {
    const primero = await adapter.anchorCommitment({ sha256: unHash, reference: "ev_1" });
    const segundo = await adapter.anchorCommitment({ sha256: otroHash, reference: "ev_2" });

    expect(segundo.txid).not.toBe(primero.txid);

    // Y la segunda entra **de verdad**: encadenar mal produce transacciones que
    // se arman bien y el nodo rechaza. Después del bloque, el vuelto de la
    // wallet tiene que venir de la segunda, que es la prueba de que las dos
    // llegaron al ledger.
    emulator.awaitBlock(1);
    const enLaWallet = await emulator.getUtxos(adapter.walletAddress);
    expect(enLaWallet.map((u) => u.txHash)).toContain(segundo.txid);
  });

  it("aguantan pedidos concurrentes, que es lo que la cola resuelve", async () => {
    // Sin cola, los dos leen el conjunto de UTxOs antes de que ninguno lo
    // invalide y no hay `overrideUTxOs()` que llegue a tiempo.
    const [primero, segundo] = await Promise.all([
      adapter.anchorCommitment({ sha256: unHash, reference: "ev_1" }),
      adapter.anchorCommitment({ sha256: otroHash, reference: "ev_2" })
    ]);

    expect(primero.txid).not.toBe(segundo.txid);
  });

  it("un anclaje que falla no arrastra al siguiente", async () => {
    // El validador rechaza nacer fuera de `Pending`; la cola tiene que quedar
    // utilizable igual.
    await expect(
      adapter.openThread({ datum: buildStageDatum({ ...fuente, state: "InProgress" }) })
    ).rejects.toThrow(/failed script execution/);

    const recibo = await adapter.anchorCommitment({ sha256: unHash, reference: "ev_1" });
    expect(recibo.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el hilo avanza sin esperar a que el bloque lo publique", async () => {
    // Es el caso del PLAN-2026-08-31 §2: crear el stage y moverlo. Antes había
    // que esperar el bloque entre las dos requests.
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

    // Reintentar sobre el mismo `outputRef` tiene que dar "no existe", no una
    // transacción armada contra una entrada consumida.
    await expect(
      adapter.advanceThread({
        outputRef: abierto.outputRef,
        previous: buildStageDatum(fuente),
        next: enCurso
      })
    ).rejects.toThrow(/No existe el UTxO/);
  });
});

describe("la vista local vence", () => {
  it("contesta mientras vale y le devuelve la palabra a la cadena cuando no", async () => {
    // Las dos mitades en un solo test a propósito: por separado, la segunda
    // pasaría también sin vista local ninguna —lo que no existe tampoco se
    // encuentra— y no probaría el vencimiento.
    //
    // Que venza es la única salida del estado malo: una transacción que el nodo
    // termina descartando deja la vista local afirmando UTxOs que no van a
    // existir nunca. Acá eso se simula no publicando el bloque.
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

// ── El reference script ─────────────────────────────────────────────────────
//
// Publicar el validador una vez y referenciarlo, en vez de adjuntar sus 2289
// bytes en cada transacción. Lo que se prueba acá es lo que importa: que el
// validador **sigue ejecutándose** —referenciado, no adjunto— y que la
// transacción sale más barata.

/** Lo que la wallet puede mostrar como saldo, sumando todos sus UTxOs. */
async function saldo(address: string, emu: Emulator): Promise<bigint> {
  const utxos = await emu.getUtxos(address);
  return utxos.reduce((total, u) => total + (u.assets.lovelace ?? 0n), 0n);
}

/** Lo que costó abrir un hilo, sin contar el ADA que queda en el hilo. */
async function feeDeAbrirHilo(a: LucidAnchorAdapter, emu: Emulator): Promise<bigint> {
  const antes = await saldo(a.walletAddress, emu);
  await a.openThread({ datum: buildStageDatum(fuente) });
  emu.awaitBlock(1);
  const despues = await saldo(a.walletAddress, emu);
  return antes - despues - THREAD_MIN_LOVELACE;
}

describe("el reference script", () => {
  it("se publica, se descubre solo y no se publica dos veces", async () => {
    const publicacion = await adapter.publishReferenceScript();
    emulator.awaitBlock(1);

    expect(publicacion.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(publicacion.outputRef).toBe(adapter.referenceScriptOutputRef);
    expect(publicacion.lovelace).toBeGreaterThan(0n);

    // Un adaptador nuevo sobre la misma wallet lo encuentra sin configuración:
    // es lo que hace la API al arrancar.
    const otro = await LucidAnchorAdapter.create({
      lucid,
      network: "Custom",
      now: () => emulator.now()
    });
    expect(otro.referenceScriptOutputRef).toBe(publicacion.outputRef);

    // Idempotente (regla 8): no gasta de nuevo y devuelve el mismo UTxO.
    const otraVez = await otro.publishReferenceScript();
    expect(otraVez.txid).toBeNull();
    expect(otraVez.outputRef).toBe(publicacion.outputRef);
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

    // Y sigue rechazando lo que rechazaba: un reference script que no ejecuta
    // el validador aceptaría cualquier transición.
    await expect(
      adapter.openThread({ datum: buildStageDatum({ ...fuente, state: "InProgress" }) })
    ).rejects.toThrow(/failed script execution/);
  });

  it("no se lo come la selección de monedas cuando la wallet queda corta", async () => {
    // **El modo de falla que este test cierra.** El UTxO del reference script
    // vive en la dirección de la wallet, así que para la selección de monedas
    // es plata: gastarlo borra el script, y desde ahí toda transacción que lo
    // referencie apunta a una entrada que no existe. Lucid dice en sus errores
    // que excluye esos UTxOs, pero en 0.6.2 solo excluye los que la propia
    // transacción declaró con `readFrom` — y un anclaje por metadata no usa el
    // validador, así que no declara ninguno.
    //
    // La wallet se funda con lo justo para publicar y quedar corta: el
    // reference script pasa a ser el único UTxO que puede pagar el anclaje
    // siguiente. Sin el filtro, ese anclaje "funciona" y se lleva puesto el
    // script. El número sale medido —el UTxO del script pide 11,04 ADA y el
    // vuelto queda en 1,08— y por eso está escrito y no calculado: si el
    // validador cambia de tamaño, este test se pone rojo y hay que volver a
    // medirlo, que es exactamente lo que queremos que pase.
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

    // Medido: 0,2976 → 0,2317 tADA. Se exige la mitad del ahorro observado
    // para no atar el test a los parámetros de protocolo del `Emulator`.
    expect(feeConRef).toBeLessThan(conAttach - 30_000n);
  });
});
