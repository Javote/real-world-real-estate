import bcrypt from "bcrypt";
import { afterAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id";
import { compileDossier } from "../src/domain/dossier";
import { transitionStage } from "../src/domain/stage-transition";
import { db } from "../src/lib/db";
import { crearStageMinteado } from "./helpers/stages";

// SPEC-018 §A5 — `compileDossier` recompila un dossier NO firmado cuyo hash
// cambió (`dossier.ts` — el `else if` que compara `masterHash` contra el
// recién calculado). Ningún test existente completa un stage entre dos
// compilaciones — todos los que hay verifican la estabilidad, no el cambio.
// Proyecto propio y aislado: completar un stage es un efecto de proyecto
// entero, y no hay que arriesgar los conteos que otras suites asumen sobre
// `FIXTURES.proyecto`.

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
    // Misma fila (mismo id, mismo shareToken si lo hubiera) — se actualiza,
    // no se duplica.
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
