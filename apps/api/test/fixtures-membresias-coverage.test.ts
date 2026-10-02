import { describe, expect, it } from "vitest";
import { sembrarMembresias, sembrarProyecto } from "../src/db/fixtures";
import { db } from "../src/lib/db";

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
