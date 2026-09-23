import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id";
import { retryStageMint, transitionStage } from "../src/domain/stage-transition";
import { anchorPort } from "../src/lib/anchor";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

// SPEC-018 §A5 — las ramas de `domain/stage-transition.ts` que ninguna otra
// suite ejercita: `verify()` devolviendo `null` (la fila queda `Pending`), y
// `transitionStage`/`retryStageMint` llamados directo (sin pasar por HTTP)
// sobre un stage inexistente, más el puerto `disabled` en el retry.

let proyecto: string;
let actorId: string;

beforeAll(async () => {
  proyecto = (
    await db
      .selectFrom("Project")
      .select("id")
      .where("slug", "=", FIXTURES.proyecto.slug)
      .executeTakeFirstOrThrow()
  ).id;
  actorId = (
    await db
      .selectFrom("User")
      .select("id")
      .where("email", "=", FIXTURES.activo.email)
      .executeTakeFirstOrThrow()
  ).id;
});

afterAll(async () => {
  await db.destroy();
});

describe("transitionStage — anclaje cuya confirmación no encuentra proof", () => {
  it("deja el evento en Pending, sin tirar", async () => {
    const puerto = anchorPort();
    const original = puerto.verify;
    puerto.verify = async () => null;

    try {
      const stage = await crearStageMinteado({
        projectId: proyecto,
        name: "SPEC-018 A5 — verify sin proof",
        sequenceOrder: 995_201,
        validationCritical: false,
        actorUserId: actorId
      });

      const resultado = await transitionStage({
        stageId: stage.id,
        to: "InProgress",
        actorUserId: actorId
      });

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.anchor.status).toBe("Pending");
        expect(resultado.anchor.txid).not.toBeNull();
      }
    } finally {
      puerto.verify = original;
    }
  });
});

describe("transitionStage · llamado directo sobre un stage inexistente", () => {
  it("STAGE_NOT_FOUND, sin pasar por HTTP", async () => {
    const resultado = await transitionStage({
      stageId: createId(),
      to: "InProgress",
      actorUserId: actorId
    });

    expect(resultado).toEqual({ ok: false, status: 404, code: "STAGE_NOT_FOUND" });
  });
});

describe("retryStageMint", () => {
  it("STAGE_NOT_FOUND sobre un stage inexistente", async () => {
    const resultado = await retryStageMint(createId());
    expect(resultado).toEqual({ ok: false, status: 404, code: "STAGE_NOT_FOUND" });
  });

  it("con el puerto disabled, no consulta la cadena antes de mintear", async () => {
    const stage = await db
      .insertInto("Stage")
      .values({
        id: createId(),
        projectId: proyecto,
        name: "SPEC-018 A5 — retry con puerto disabled",
        sequenceOrder: 995_202,
        state: "Pending",
        validationCritical: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Sin ningún OnChainEvent STAGE_CREATED: alcanza para que, con la consulta
    // a la cadena salteada, la función siga hasta el 404 de más abajo en vez
    // de tirar por preguntarle a un puerto inhabilitado.
    const puerto = anchorPort();
    const modoOriginal = puerto.mode;
    let consultas = 0;
    const original = puerto.findLiveThread;
    puerto.findLiveThread = async (ref: string) => {
      consultas++;
      return original.call(puerto, ref);
    };
    Object.defineProperty(puerto, "mode", { value: "disabled", configurable: true });

    try {
      const resultado = await retryStageMint(stage.id);
      expect(consultas).toBe(0);
      expect(resultado).toEqual({
        ok: false,
        status: 404,
        code: "STAGE_CREATED_EVENT_NOT_FOUND"
      });
    } finally {
      Object.defineProperty(puerto, "mode", { value: modoOriginal, configurable: true });
      puerto.findLiveThread = original;
    }
  });
});
