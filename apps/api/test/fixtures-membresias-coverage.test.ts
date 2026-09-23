import { describe, expect, it } from "vitest";
import { sembrarMembresias, sembrarProyecto } from "../src/db/fixtures";
import { db } from "../src/lib/db";

// SPEC-018 §A6 — `sembrarMembresias(db, projectId, [])`: el early-return
// cuando no hay membresías que insertar. `test/global-setup.ts` siempre la
// llama con una lista no vacía; un proyecto sin miembros (como
// `FIXTURES.otroProyecto`, ya sembrado) hoy simplemente no la invoca.

describe("sembrarMembresias con lista vacía", () => {
  it("no inserta nada y no revienta", async () => {
    const projectId = await sembrarProyecto(db, {
      slug: `spec-018-a6-sin-miembros-${Date.now()}`,
      name: "Sin miembros",
      status: "planning",
      totalUnits: 1
    });

    await expect(sembrarMembresias(db, projectId, [])).resolves.toBeUndefined();

    const filas = await db
      .selectFrom("ProjectMember")
      .selectAll()
      .where("projectId", "=", projectId)
      .execute();
    expect(filas).toEqual([]);
  });
});
