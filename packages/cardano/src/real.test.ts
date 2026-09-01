import { generateEmulatorAccount, Lucid } from "@lucid-evolution/lucid";
import { Emulator } from "@lucid-evolution/provider";
import { buildStageDatum } from "@plataforma/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { LucidAnchorAdapter, PENDING_UTXO_TTL_MS } from "./real";

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
/**
 * Cuánto se le suma al reloj del `Emulator`. Los tests de la vista local lo
 * mueven para vencerla sin esperar tres minutos de verdad.
 */
let desfase: number;

beforeEach(async () => {
  const cuenta = generateEmulatorAccount({ lovelace: 500_000_000n });
  emulator = new Emulator([cuenta]);
  desfase = 0;
  const lucid = await Lucid(emulator, "Custom");
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
