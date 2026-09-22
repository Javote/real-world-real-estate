import { afterAll, describe, expect, it } from "vitest";
import { sembrarOrganizacion, sembrarProyecto, sembrarStages } from "../src/db/fixtures";
import { db } from "../src/lib/db";

// `sembrarUsuarios`, `sembrarProyecto`, `sembrarMembresias` y
// `sembrarUnidadVendida` ya se ejercitan en cada corrida vía
// `test/global-setup.ts` (SPEC-015 §2) — es la misma plantilla que copia cada
// archivo. `sembrarOrganizacion` y `sembrarStages` son los dos constructores
// que también usa `src/db/seed.ts` (el mundo demostrable) y que `global-setup`
// nunca llama: sin este archivo, el único lugar donde corrían era el seed de
// desarrollo, a mano, nunca en la suite.

afterAll(async () => {
  await db.destroy();
});

describe("sembrarOrganizacion", () => {
  it("inserta la organización y devuelve su id", async () => {
    const id = await sembrarOrganizacion(db, {
      slug: "spec-017-organizacion",
      name: "Constructora de Prueba",
      bio: "Bio de prueba",
      foundedYear: 2010
    });

    const fila = await db
      .selectFrom("Organization")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

    expect(fila.name).toBe("Constructora de Prueba");
    expect(fila.foundedYear).toBe(2010);
  });

  it("es idempotente por slug — no reconcilia, solo evita el choque", async () => {
    const primera = await sembrarOrganizacion(db, {
      slug: "spec-017-organizacion-idempotente",
      name: "Nombre original"
    });

    // Un segundo llamado con OTRO nombre no lo pisa: `onConflict doNothing`
    // deja la fila como estaba, y por eso la organización de una base ya
    // sembrada no cambia entre corridas del seed.
    const segunda = await sembrarOrganizacion(db, {
      slug: "spec-017-organizacion-idempotente",
      name: "Nombre que no debería quedar"
    });

    expect(segunda).toBe(primera);

    const fila = await db
      .selectFrom("Organization")
      .selectAll()
      .where("id", "=", primera)
      .executeTakeFirstOrThrow();
    expect(fila.name).toBe("Nombre original");
  });
});

describe("sembrarStages", () => {
  it("inserta las etapas del proyecto, en el estado pedido", async () => {
    const projectId = await sembrarProyecto(db, {
      slug: "spec-017-proyecto-stages",
      name: "Proyecto de prueba de stages",
      totalUnits: 1,
      status: "planning"
    });

    await sembrarStages(db, projectId, [
      { name: "Fundación", sequenceOrder: 1, state: "InProgress" },
      { name: "Estructura", sequenceOrder: 2, state: "Pending" }
    ]);

    const stages = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", projectId)
      .orderBy("sequenceOrder", "asc")
      .execute();

    expect(stages).toHaveLength(2);
    expect(stages[0]?.state).toBe("InProgress");
    expect(stages[0]?.validationCritical).toBe(true);
    expect(stages[1]?.state).toBe("Pending");
  });

  it("es idempotente por (projectId, sequenceOrder) — un stage ya sembrado no se duplica", async () => {
    const projectId = await sembrarProyecto(db, {
      slug: "spec-017-proyecto-stages-idempotente",
      name: "Proyecto de prueba idempotente",
      totalUnits: 1,
      status: "planning"
    });

    const etapas = [{ name: "Fundación", sequenceOrder: 1, state: "InProgress" as const }];
    await sembrarStages(db, projectId, etapas);
    await sembrarStages(db, projectId, etapas);

    const stages = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", projectId)
      .execute();

    expect(stages).toHaveLength(1);
  });
});
