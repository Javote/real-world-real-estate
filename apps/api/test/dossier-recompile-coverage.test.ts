import bcrypt from "bcrypt";
import { afterAll, describe, expect, it } from "vitest";
import { sembrarUnidadVendida } from "../src/db/fixtures.js";
import { createId } from "../src/db/id.js";
import { transitionStage } from "../src/domain/stage-transition.js";
import { db } from "../src/lib/db.js";
import { leerDeLaUnidad } from "../src/modules/dossier/casos.js";
import { crearStageMinteado } from "./helpers/stages.js";

afterAll(async () => {
  await db.destroy();
});

const leer = async (unitId: string) => {
  const leido = await leerDeLaUnidad({ db, clock: () => new Date() }, unitId);
  if (!leido.ok) throw new Error(leido.code);
  return leido.value;
};

describe("el dossier se calcula al leerlo, cuando lo que compromete cambió", () => {
  it("el masterHash cambia al completar un stage del proyecto, y leerlo no escribe la fila", async () => {
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

    const { unitId } = await sembrarUnidadVendida(db, {
      projectId: proyecto,
      investorId,
      unitReference: `SPEC018-A5-RECOMPILE-${investorId}`,
      floor: 1,
      sizeM2: 40,
      priceMinorUnits: 5_000_000,
      currency: "USD"
    });

    const primero = await leer(unitId);
    const dossierId = primero.id;
    const hashInicial = primero.masterHash;

    const stage = await crearStageMinteado({
      projectId: proyecto,
      name: "SPEC-018 A5 — stage que cambia el compromiso",
      sequenceOrder: 1,
      validationCritical: false,
      actorUserId: investorId
    });
    await transitionStage({ stageId: stage.id, to: "InProgress", actorUserId: investorId });
    await transitionStage({ stageId: stage.id, to: "Completed", actorUserId: investorId });

    const segundo = await leer(unitId);
    expect(segundo.id).toBe(dossierId);
    expect(segundo.masterHash).not.toBe(hashInicial);
    expect(segundo.status).toBe("compiled");

    const fila = await db
      .selectFrom("Dossier")
      .select(["id", "masterHash"])
      .where("unitId", "=", unitId)
      .executeTakeFirstOrThrow();
    expect(fila).toEqual({ id: dossierId, masterHash: "" });
  });
});
