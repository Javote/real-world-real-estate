import { generateEmulatorAccount, Lucid } from "@lucid-evolution/lucid";
import { Emulator } from "@lucid-evolution/provider";
import { buildStageDatum } from "@plataforma/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { LucidAnchorAdapter } from "./real";

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

beforeEach(async () => {
  const cuenta = generateEmulatorAccount({ lovelace: 500_000_000n });
  emulator = new Emulator([cuenta]);
  const lucid = await Lucid(emulator, "Custom");
  lucid.selectWallet.fromSeed(cuenta.seedPhrase);
  adapter = await LucidAnchorAdapter.create({
    lucid,
    network: "Custom",
    now: () => emulator.now()
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
    const recibo = await adapter.anchorEvidence({ sha256, reference: "ev_123" });
    emulator.awaitBlock(1);

    expect(recibo.txid).toMatch(/^[0-9a-f]{64}$/);
    // No quedó ningún UTxO nuevo en la dirección del script.
    expect(await adapter.verify(recibo.txid)).toBeNull();
  });

  it("rechaza lo que no sea un SHA-256", async () => {
    await expect(adapter.anchorEvidence({ sha256: "corto", reference: "ev" })).rejects.toThrow(
      /SHA-256/
    );
  });

  it("rechaza una ref que no entre en un string de metadata", async () => {
    // 64 bytes es el tope de una cadena de metadata (regla 2).
    await expect(adapter.anchorEvidence({ sha256, reference: "x".repeat(65) })).rejects.toThrow(
      /no entra/
    );
  });
});
