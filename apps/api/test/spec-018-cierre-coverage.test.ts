import { buildStageDatum, refToHex } from "@plataforma/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createId } from "../src/db/id";
import { anchorCommitmentEvent } from "../src/domain/anchoring";
import { notify, notifyUnitInvestors } from "../src/domain/notify";
import { reconciliarParaLectura, repararHilosSospechosos } from "../src/domain/reconcile";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-018 §Consolidación — los tres catches que quedaron sin ejercitar
// después de A1-A6: `anchoring.ts` (confirmar un commitment que falla),
// `notify.ts` (el INSERT de una notificación que viola una FK), y
// `reconcile.ts` (el catch externo de `reconciliarParaLectura` — distinto
// del catch interno por-evento que `reconcile.test.ts` ya cubre — y el
// `findLiveThread` que falla para UN sospechoso sin tumbar a los demás).

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

describe("anchorCommitmentEvent — la confirmación falla, el anclaje ya está guardado", () => {
  it("no propaga, solo loguea: el evento queda Pending con su txid", async () => {
    const puerto = anchorPort();
    const original = puerto.confirmedAt;
    puerto.confirmedAt = async () => {
      throw new Error("Blockfrost 502, a propósito");
    };
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const evento = await anchorCommitmentEvent({
        projectId: proyecto,
        eventType: "EVIDENCE_ANCHOR",
        commitment: "a".repeat(64),
        reference: createId()
      });

      expect(evento.txid).not.toBeNull();
      expect(evento.status).toBe("Pending");
      expect(espia).toHaveBeenCalled();
    } finally {
      puerto.confirmedAt = original;
      espia.mockRestore();
    }
  });
});

describe("notify — el INSERT viola una restricción", () => {
  it("notify: se traga el error, no tumba a quien la llamó", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(
        notify({
          userId: "usuario-que-no-existe",
          category: "document",
          titleKey: "notifications.evidence.uploaded"
        })
      ).resolves.toBeUndefined();

      expect(espia).toHaveBeenCalled();
    } finally {
      espia.mockRestore();
    }
  });

  it("notifyUnitInvestors: mismo criterio para el INSERT múltiple", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(
        notifyUnitInvestors([{ unitId: createId(), investorId: "investor-que-no-existe" }], {
          category: "document",
          titleKey: "notifications.evidence.uploaded"
        })
      ).resolves.toBeUndefined();

      expect(espia).toHaveBeenCalled();
    } finally {
      espia.mockRestore();
    }
  });
});

describe("reconciliarParaLectura — el catch EXTERNO, no el de por-evento", () => {
  it("un fallo sincrónico al preguntar el modo del puerto tampoco propaga", async () => {
    const puerto = anchorPort();
    const descriptorOriginal = Object.getOwnPropertyDescriptor(puerto, "mode");
    Object.defineProperty(puerto, "mode", {
      get() {
        throw new Error("el puerto no puede contestar ni eso, a propósito");
      },
      configurable: true
    });
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(reconciliarParaLectura({ projectId: proyecto })).resolves.toBeUndefined();

      expect(espia).toHaveBeenCalledWith(
        "[reconcile] la reconciliación por lectura falló",
        expect.anything()
      );
    } finally {
      Object.defineProperty(puerto, "mode", descriptorOriginal!);
      espia.mockRestore();
    }
  });
});

describe("repararHilosSospechosos — findLiveThread falla para UNO, sigue con los demás", () => {
  it("el sospechoso que revienta no tumba la tanda", async () => {
    async function stage() {
      const id = createId();
      const ahora = new Date();
      await db
        .insertInto("Stage")
        .values({
          id,
          projectId: proyecto,
          name: "SPEC-018 cierre — findLiveThread falla",
          sequenceOrder: Math.floor(Math.random() * 1_000_000) + 700_000,
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

    // El que revienta.
    const idRompe = await stage();
    const eventoRompe = await transicionSinTxid(idRompe, 0);
    await transicionConTxid(idRompe, 1, `cierre-rompe-${idRompe}`);

    // El que sí se repara: hilo real abierto y avanzado.
    const idSano = await stage();
    const pending = buildStageDatum({
      id: idSano,
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
    const eventoSano = await transicionSinTxid(idSano, 0);
    await transicionConTxid(idSano, 1, `cierre-sano-${idSano}`);

    const puerto = anchorPort();
    const original = puerto.findLiveThread;
    puerto.findLiveThread = async (ref: string) => {
      if (ref === refToHex(idRompe)) {
        throw new Error("Blockfrost 502, solo para este sospechoso");
      }
      return original.call(puerto, ref);
    };
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const reparados = await repararHilosSospechosos();

      expect(espia).toHaveBeenCalledWith(
        "[reconcile] findLiveThread falló para un sospechoso",
        expect.objectContaining({ eventId: eventoRompe })
      );
      expect(reparados.map((r) => r.eventId)).not.toContain(eventoRompe);
      expect(reparados).toContainEqual({
        eventId: eventoSano,
        txid: hilo.txid,
        outputRef: hilo.outputRef
      });
    } finally {
      puerto.findLiveThread = original;
      espia.mockRestore();
    }
  });
});
