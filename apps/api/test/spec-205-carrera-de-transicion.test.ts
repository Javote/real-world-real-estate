import { afterAll, describe, expect, it } from "vitest";
import { transitionStage } from "../src/domain/stage-transition.js";
import { db } from "../src/lib/db.js";
import { FIXTURES } from "./global-setup.js";
import { crearStageMinteado } from "./helpers/stages.js";

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

    expect(ganadores).toHaveLength(1);
    expect(perdedores).toHaveLength(1);
    expect(perdedores[0]).toMatchObject({
      ok: false,
      status: 409,
      code: "STAGE_TRANSITION_INVALID"
    });

    const fila = await db
      .selectFrom("Stage")
      .select(["state"])
      .where("id", "=", stage.id)
      .executeTakeFirstOrThrow();
    expect(fila.state).toBe("Observed");

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
