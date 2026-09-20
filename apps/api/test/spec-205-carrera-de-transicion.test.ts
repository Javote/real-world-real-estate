import { afterAll, describe, expect, it } from "vitest";
import { transitionStage } from "../src/domain/stage-transition";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";
import { crearStageMinteado } from "./helpers/stages";

// SPEC-205 (B-05) — `transitionStage` leía `existing.state`, preguntaba
// `canTransition` contra ese valor, y escribía el UPDATE condicionado SOLO
// por `id` — sin volver a exigir que el estado leído siguiera vigente. Dos
// transiciones concurrentes sobre el mismo stage leen las dos el mismo
// estado de partida, pasan las dos la tabla de transiciones, y escriben las
// dos. El índice único (stageId, eventIndex) evita el OnChainEvent gemelo,
// pero el UPDATE de Stage ya corrió dos veces — mismo patrón que SPEC-201
// (B-01) y SPEC-202 (B-02) ya cerraron del lado de invitaciones y dossiers.

describe("transitionStage — dos transiciones concurrentes sobre el mismo stage", () => {
  afterAll(async () => {
    await db.destroy();
  });

  it("una gana, la otra recibe STAGE_TRANSITION_INVALID — no las dos ok:true", async () => {
    const actorId = (
      await db
        .selectFrom("User")
        .select("id")
        .where("email", "=", FIXTURES.activo.email)
        .executeTakeFirstOrThrow()
    ).id;

    const stage = await crearStageMinteado({
      projectId: (
        await db
          .selectFrom("Project")
          .select("id")
          .where("slug", "=", FIXTURES.proyecto.slug)
          .executeTakeFirstOrThrow()
      ).id,
      name: "SPEC-205 carrera",
      sequenceOrder: 995_101,
      validationCritical: false,
      actorUserId: actorId
    });
    await transitionStage({ stageId: stage.id, to: "InProgress", actorUserId: actorId });

    const [a, b] = await Promise.all([
      transitionStage({ stageId: stage.id, to: "Observed", actorUserId: actorId }),
      transitionStage({ stageId: stage.id, to: "Observed", actorUserId: actorId })
    ]);

    const resultados = [a, b];
    const ganadores = resultados.filter((r) => r.ok);
    const perdedores = resultados.filter((r) => !r.ok);

    // Invariante 1 y 2: a lo sumo una escritura real gana la carrera.
    expect(ganadores).toHaveLength(1);
    expect(perdedores).toHaveLength(1);
    expect(perdedores[0]).toMatchObject({
      ok: false,
      status: 409,
      code: "STAGE_TRANSITION_INVALID"
    });

    // El UPDATE de Stage no corrió dos veces: una sola fila, un solo estado final.
    const fila = await db
      .selectFrom("Stage")
      .select(["state"])
      .where("id", "=", stage.id)
      .executeTakeFirstOrThrow();
    expect(fila.state).toBe("Observed");

    // El índice único (stageId, eventIndex) no alcanza a probar esto solo:
    // si el UPDATE hubiera corrido dos veces, igual habría un solo
    // STAGE_TRANSITION porque el que pierde la carrera de abajo nunca llega
    // a pedir su evento. Se verifica de las dos formas.
    const eventos = await db
      .selectFrom("OnChainEvent")
      .select(["id"])
      .where("stageId", "=", stage.id)
      .where("eventType", "=", "STAGE_TRANSITION")
      .where("toState", "=", "Observed")
      .execute();
    expect(eventos).toHaveLength(1);
  });

  it("sin concurrencia, una transición válida sigue funcionando igual que antes", async () => {
    const actorId = (
      await db
        .selectFrom("User")
        .select("id")
        .where("email", "=", FIXTURES.activo.email)
        .executeTakeFirstOrThrow()
    ).id;

    const stage = await crearStageMinteado({
      projectId: (
        await db
          .selectFrom("Project")
          .select("id")
          .where("slug", "=", FIXTURES.proyecto.slug)
          .executeTakeFirstOrThrow()
      ).id,
      name: "SPEC-205 sin carrera",
      sequenceOrder: 995_102,
      validationCritical: false,
      actorUserId: actorId
    });
    await transitionStage({ stageId: stage.id, to: "InProgress", actorUserId: actorId });

    const resultado = await transitionStage({
      stageId: stage.id,
      to: "Observed",
      actorUserId: actorId
    });

    expect(resultado.ok).toBe(true);
  });
});
