import { buildStageDatum } from "@plataforma/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id";
import { repararHilosSospechosos } from "../src/domain/reconcile";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-018 §A5 — las dos ramas de `repararHilosSospechosos` que
// `reconcile.test.ts` no alcanza: el puerto inhabilitado, y la carrera donde
// otro proceso ya escribió el `txid` entre el `findLiveThread` y el `UPDATE`.

let proyecto: string;

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

async function stage() {
  const id = createId();
  const ahora = new Date();
  await db
    .insertInto("Stage")
    .values({
      id,
      projectId: proyecto,
      name: "Stage de reconciliación (A5)",
      sequenceOrder: Math.floor(Math.random() * 1_000_000) + 500_000,
      state: "InProgress",
      validationCritical: false,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function transicionSinTxid(stageId: string, eventIndex: number) {
  const id = createId();
  const ahora = new Date();
  await db
    .insertInto("OnChainEvent")
    .values({
      id,
      projectId: proyecto,
      stageId,
      evidenceId: null,
      referenceId: null,
      eventIndex,
      eventType: "STAGE_TRANSITION",
      fromState: "Observed",
      toState: "InProgress",
      commitment: null,
      status: "Pending",
      txid: null,
      network: null,
      outputRef: null,
      blockTimestamp: null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

async function transicionConTxid(stageId: string, eventIndex: number, txid: string) {
  await db
    .insertInto("OnChainEvent")
    .values({
      id: createId(),
      projectId: proyecto,
      stageId,
      evidenceId: null,
      referenceId: null,
      eventIndex,
      eventType: "STAGE_TRANSITION",
      fromState: "Observed",
      toState: "InProgress",
      commitment: null,
      status: "Confirmed",
      txid,
      network: "Simulated",
      outputRef: `${txid}#0`,
      blockTimestamp: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .execute();
}

describe("repararHilosSospechosos · puerto inhabilitado", () => {
  it("no consulta la cadena y devuelve una lista vacía", async () => {
    const puerto = anchorPort();
    const modoOriginal = puerto.mode;
    const original = puerto.findLiveThread;
    let llamadas = 0;
    puerto.findLiveThread = async (ref: string) => {
      llamadas++;
      return original.call(puerto, ref);
    };
    Object.defineProperty(puerto, "mode", { value: "disabled", configurable: true });

    try {
      const reparados = await repararHilosSospechosos();
      expect(reparados).toEqual([]);
      expect(llamadas).toBe(0);
    } finally {
      Object.defineProperty(puerto, "mode", { value: modoOriginal, configurable: true });
      puerto.findLiveThread = original;
    }
  });
});

describe("repararHilosSospechosos · la carrera con otro proceso", () => {
  it("no reparado si el txid ya se escribió entre el findLiveThread y el UPDATE", async () => {
    const id = await stage();
    const pending = buildStageDatum({
      id,
      projectId: proyecto,
      sequenceOrder: 1,
      validationCritical: false,
      state: "Pending"
    });
    const abierto = await anchorPort().openThread({ datum: pending });
    const inProgress = { ...pending, state: "InProgress" as const };
    const hilo = await anchorPort().advanceThread({
      outputRef: abierto.outputRef,
      previous: pending,
      next: inProgress
    });

    const eventId = await transicionSinTxid(id, 0);
    await transicionConTxid(id, 1, `carrera-${id}`);

    const puerto = anchorPort();
    const original = puerto.findLiveThread;
    puerto.findLiveThread = async (ref: string) => {
      const resultado = await original.call(puerto, ref);
      // Simula que otro proceso ganó la carrera y ya escribió el txid justo
      // acá, antes de que este código llegue a su propio UPDATE.
      await db
        .updateTable("OnChainEvent")
        .set({ txid: "otro-proceso-gano", network: "Simulated", updatedAt: new Date() })
        .where("id", "=", eventId)
        .execute();
      return resultado;
    };

    try {
      const reparados = await repararHilosSospechosos();
      expect(reparados.map((r) => r.eventId)).not.toContain(eventId);

      const fila = await db
        .selectFrom("OnChainEvent")
        .select("txid")
        .where("id", "=", eventId)
        .executeTakeFirstOrThrow();
      // El `WHERE txid IS NULL` del propio update no matcheó: el valor que
      // quedó es el que escribió "el otro proceso", no `hilo.txid`.
      expect(fila.txid).toBe("otro-proceso-gano");
      expect(fila.txid).not.toBe(hilo.txid);
    } finally {
      puerto.findLiveThread = original;
    }
  });
});
