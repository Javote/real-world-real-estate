import bcrypt from "bcrypt";
import { afterAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id.js";
import { compileDossier } from "../src/domain/dossier.js";
import { transitionStage } from "../src/domain/stage-transition.js";
import { db } from "../src/lib/db.js";
import { crearStageMinteado } from "./helpers/stages.js";

afterAll(async () => {
  await db.destroy();
});

describe("compileDossier — recompila cuando lo que compromete cambió", () => {
  it("el masterHash cambia al completar un stage del proyecto", async () => {
    const ahora = new Date();

    const proyecto = createId();
    await db
      .insertInto("Project")
      .values({
        id: proyecto,
        slug: `spec-018-a5-recompile-${proyecto}`,
        name: "SPEC-018 A5 — recompilar dossier",
        city: "Buenos Aires",
        status: "in_progress",
        totalUnits: 1,
        estimatedDelivery: ahora,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const investorId = createId();
    await db
      .insertInto("User")
      .values({
        id: investorId,
        email: `dossier-recompile-${investorId}@test.local`,
        passwordHash: await bcrypt.hash("dossier-recompile-pass", 10),
        fullName: "Investor SPEC-018 A5",
        role: "buyer",
        isActive: true,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const unitId = createId();
    await db
      .insertInto("Unit")
      .values({
        id: unitId,
        projectId: proyecto,
        unitReference: `SPEC018-A5-RECOMPILE-${unitId}`,
        status: "sold",
        priceMinorUnits: 5_000_000,
        currency: "USD",
        investorId,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const primero = await compileDossier(unitId);
    expect(primero).not.toBeNull();
    const dossierId = primero!.id;
    const hashInicial = primero!.masterHash;

    const stage = await crearStageMinteado({
      projectId: proyecto,
      name: "SPEC-018 A5 — stage que cambia el compromiso",
      sequenceOrder: 1,
      validationCritical: false,
      actorUserId: investorId
    });
    await transitionStage({ stageId: stage.id, to: "InProgress", actorUserId: investorId });
    await transitionStage({ stageId: stage.id, to: "Completed", actorUserId: investorId });

    const segundo = await compileDossier(unitId);
    expect(segundo).not.toBeNull();
    expect(segundo!.id).toBe(dossierId);
    expect(segundo!.masterHash).not.toBe(hashInicial);

    const fila = await db
      .selectFrom("Dossier")
      .select(["id", "masterHash"])
      .where("unitId", "=", unitId)
      .executeTakeFirstOrThrow();
    expect(fila.id).toBe(dossierId);
    expect(fila.masterHash).toBe(segundo!.masterHash);
  });
});
