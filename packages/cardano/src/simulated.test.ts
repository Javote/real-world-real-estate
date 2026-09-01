import { buildStageDatum } from "@plataforma/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createAnchorPort } from "./factory";
import { InMemoryLedgerStore } from "./ledger";
import { AnchorRejectedError } from "./port";
import { SimulatedAnchorAdapter } from "./simulated";

// SPEC-013 §Casos borde. Cada rechazo del simulador espeja un `expect` del
// validador: si esta suite se ablanda, el bug se muda a una transacción firmada.

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
    expect(recibo.status).toBe("Confirmed");
    expect(recibo.outputRef).toBe(`${recibo.txid}#0`);
  });

  it("rechaza un segundo hilo para el mismo stage", async () => {
    // Es la propiedad del thread token: un solo hilo por stage, o el
    // verificador ve dos historias y tiene que preguntarnos cuál vale.
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

    // Y con el commitment, pasa.
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
    expect(completo.status).toBe("Confirmed");
  });

  it("los rechazos son AnchorRejectedError, no fallos de infraestructura", async () => {
    // La distinción decide si se reintenta: un rechazo de regla da lo mismo
    // cuantas veces se repita.
    await expect(
      port.advanceThread({ outputRef: "no-existe#0", previous: pending, next: inProgress })
    ).rejects.toBeInstanceOf(AnchorRejectedError);
  });
});

describe("createAnchorPort", () => {
  it("por defecto es simulated", async () => {
    expect((await createAnchorPort({})).mode).toBe("simulated");
  });

  it("revienta con un modo inventado", async () => {
    await expect(createAnchorPort({ mode: "mainnet" })).rejects.toThrow(/ANCHOR_MODE inválido/);
  });

  // ── `real`: lo que se puede probar sin red ──────────────────────────────
  //
  // El camino feliz de `real` necesita Blockfrost y una wallet, así que vive en
  // `yaci.test.ts` y en Preprod a mano. Lo que sí se prueba acá —y es lo que
  // más barato se rompe— son los rechazos de configuración: tienen que ocurrir
  // ANTES de tocar la red, o el error que llega es un timeout en vez de "te
  // falta la clave".

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
    expect(a.status).toBe("Confirmed");
  });

  it("rechaza un hash que no sea SHA-256", async () => {
    await expect(port.anchorCommitment({ sha256: "corto", reference: "ev" })).rejects.toMatchObject(
      {
        code: "BAD_EVIDENCE_HASH"
      }
    );
  });
});
