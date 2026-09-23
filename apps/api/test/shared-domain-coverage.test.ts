import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createId } from "../src/db/id";
import { db } from "../src/lib/db";
import { avancePorProyecto, relanzarRestriccionComoOrpc } from "../src/routes/_shared";
import { FIXTURES } from "./global-setup";

// SPEC-018 §A5 — `routes/_shared.ts`, llamado directo: el error que no es de
// restricción, y `avancePorProyecto` con una lista vacía y con un proyecto
// sin stages.

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

describe("relanzarRestriccionComoOrpc con un error que no es de restricción", () => {
  it("lo relanza tal cual, sin envolverlo", () => {
    const original = new Error("un fallo cualquiera, no una constraint");
    const errors = {
      RESOURCE_ALREADY_EXISTS: (opts: { message: string }) => new Error(opts.message),
      RELATED_RESOURCE_NOT_FOUND: (opts: { message: string }) => new Error(opts.message)
    };

    expect(() => relanzarRestriccionComoOrpc(original, errors)).toThrow(original);
  });
});

describe("avancePorProyecto", () => {
  it("con una lista vacía, devuelve un Map vacío sin consultar la base", async () => {
    const mapa = await avancePorProyecto([]);
    expect(mapa.size).toBe(0);
  });

  it("un proyecto sin stages da 0, no NaN", async () => {
    const ahora = new Date();
    const proyectoVacio = createId();
    await db
      .insertInto("Project")
      .values({
        id: proyectoVacio,
        slug: `spec-018-a5-sin-stages-${proyectoVacio}`,
        name: "SPEC-018 A5 — proyecto sin stages",
        city: "Buenos Aires",
        status: "in_progress",
        totalUnits: 0,
        estimatedDelivery: ahora,
        createdAt: ahora,
        updatedAt: ahora
      })
      .execute();

    const mapa = await avancePorProyecto([proyecto, proyectoVacio]);
    expect(mapa.get(proyectoVacio)).toBe(0);
  });
});
