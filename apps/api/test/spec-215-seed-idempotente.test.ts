import bcrypt from "bcrypt";
import { afterAll, describe, expect, it } from "vitest";
import { sembrarUnidadVendida } from "../src/db/fixtures";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { FIXTURES } from "./global-setup";

// SPEC-215 — `sembrarUnidadVendida` hacía `onConflict().doNothing()` seguido
// de `executeTakeFirstOrThrow()`, una contradicción: `doNothing` por
// definición no devuelve fila cuando la fila ya existe, así que sobre una
// base ya sembrada tiraba `NoResultError` y dejaba el resto del seed sin
// correr (`sembrarUsuarios`, antes en la secuencia, ya había escrito). Reduce
// a la forma que `sembrarProyecto` ya usaba bien: insertar tolerando el
// conflicto, releer por la clave natural.

let proyecto: string;
let investor: string;

async function crearInvestor(email: string) {
  const ahora = new Date();
  const id = createId();
  await db
    .insertInto("User")
    .values({
      id,
      email,
      passwordHash: await bcrypt.hash("spec215pass", 10),
      fullName: "Investor SPEC-215",
      role: "buyer",
      isActive: true,
      createdAt: ahora,
      updatedAt: ahora
    })
    .execute();
  return id;
}

afterAll(async () => {
  await db.destroy();
});

describe("sembrarUnidadVendida es idempotente", () => {
  it("correrla dos veces con el mismo input no tira y devuelve los MISMOS ids", async () => {
    proyecto ??= (
      await db
        .selectFrom("Project")
        .select("id")
        .where("slug", "=", FIXTURES.proyecto.slug)
        .executeTakeFirstOrThrow()
    ).id;
    investor ??= await crearInvestor(`spec215-a-${createId()}@test.local`);

    const input = {
      projectId: proyecto,
      investorId: investor,
      unitReference: `SPEC215-A-${createId()}`,
      floor: 1,
      sizeM2: 50,
      priceMinorUnits: 5_000_000,
      currency: "USD"
    };

    const primera = await sembrarUnidadVendida(db, input);
    const segunda = await sembrarUnidadVendida(db, input);

    expect(segunda.unitId).toBe(primera.unitId);
    expect(segunda.contractId).toBe(primera.contractId);

    const unidades = await db
      .selectFrom("Unit")
      .selectAll()
      .where("projectId", "=", proyecto)
      .where("unitReference", "=", input.unitReference)
      .execute();
    expect(unidades).toHaveLength(1);

    const contratos = await db
      .selectFrom("Contract")
      .selectAll()
      .where("unitId", "=", primera.unitId)
      .execute();
    expect(contratos).toHaveLength(1);
  });

  it("sobre una base sembrada A MEDIAS (Unit ya existe, Contract no) completa lo que falta", async () => {
    proyecto ??= (
      await db
        .selectFrom("Project")
        .select("id")
        .where("slug", "=", FIXTURES.proyecto.slug)
        .executeTakeFirstOrThrow()
    ).id;
    investor ??= await crearInvestor(`spec215-b-${createId()}@test.local`);

    const unitReference = `SPEC215-B-${createId()}`;
    const ahora = new Date();

    // Reproduce el estado a medias: la Unit quedó insertada (por ejemplo, por
    // una corrida anterior que reventó ANTES del insert de Contract).
    await db
      .insertInto("Unit")
      .values({
        id: createId(),
        projectId: proyecto,
        unitReference,
        status: "sold",
        floor: 2,
        sizeM2: 60,
        priceMinorUnits: 6_000_000,
        currency: "USD",
        investorId: investor,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const antesDelSeed = await db
      .selectFrom("Contract")
      .selectAll()
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .where("Unit.unitReference", "=", unitReference)
      .execute();
    expect(antesDelSeed).toHaveLength(0);

    const resultado = await sembrarUnidadVendida(db, {
      projectId: proyecto,
      investorId: investor,
      unitReference,
      floor: 2,
      sizeM2: 60,
      priceMinorUnits: 6_000_000,
      currency: "USD"
    });

    // No duplicó la Unit que ya existía, y completó el Contract que faltaba.
    const unidades = await db
      .selectFrom("Unit")
      .selectAll()
      .where("projectId", "=", proyecto)
      .where("unitReference", "=", unitReference)
      .execute();
    expect(unidades).toHaveLength(1);

    const contrato = await db
      .selectFrom("Contract")
      .selectAll()
      .where("unitId", "=", resultado.unitId)
      .executeTakeFirst();
    expect(contrato).toBeDefined();
    expect(contrato?.id).toBe(resultado.contractId);
  });
});
