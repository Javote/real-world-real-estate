import { afterEach, describe, expect, it } from "vitest";
import { sembrarDemo } from "../src/db/seed.js";
import { db } from "../src/lib/db.js";

const ENV_VARS = ["SEED_ADMIN_PASSWORD", "SEED_DEMO_PASSWORD"] as const;
let previo: Record<string, string | undefined> = {};

afterEach(() => {
  for (const v of ENV_VARS) {
    if (previo[v] === undefined) delete process.env[v];
    else process.env[v] = previo[v];
  }
  previo = {};
});

describe("sembrarDemo", () => {
  it("sin variables de entorno — usa los defaults locales y arma el mundo completo", async () => {
    for (const v of ENV_VARS) {
      previo[v] = process.env[v];
      delete process.env[v];
    }

    await sembrarDemo();

    const admin = await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", "admin@example.com")
      .executeTakeFirstOrThrow();
    expect(admin.role).toBe("admin");
    expect(admin.isActive).toBe(true);

    const organizacion = await db
      .selectFrom("Organization")
      .selectAll()
      .where("slug", "=", "grupo-alpine")
      .executeTakeFirstOrThrow();
    expect(organizacion.name).toBe("Grupo Alpine");

    const proyecto = await db
      .selectFrom("Project")
      .selectAll()
      .where("slug", "=", "torre-a")
      .executeTakeFirstOrThrow();
    expect(proyecto.organizationId).toBe(organizacion.id);

    const stages = await db
      .selectFrom("Stage")
      .selectAll()
      .where("projectId", "=", proyecto.id)
      .orderBy("sequenceOrder", "asc")
      .execute();
    expect(stages[0]?.state).toBe("InProgress");
    expect(stages.slice(1).every((s) => s.state === "Pending")).toBe(true);

    const unidad = await db
      .selectFrom("Unit")
      .selectAll()
      .where("projectId", "=", proyecto.id)
      .where("unitReference", "=", "4B")
      .executeTakeFirstOrThrow();
    expect(unidad.status).toBe("sold");

    const dossier = await db
      .selectFrom("Dossier")
      .selectAll()
      .where("unitId", "=", unidad.id)
      .executeTakeFirst();
    expect(dossier).toBeDefined();
  });

  it("con las variables presentes, es idempotente y actualiza el hash de la password", async () => {
    process.env.SEED_ADMIN_PASSWORD = "una password valida y larga 1";
    process.env.SEED_DEMO_PASSWORD = "otra password valida y larga 2";
    previo.SEED_ADMIN_PASSWORD = undefined;
    previo.SEED_DEMO_PASSWORD = undefined;

    await sembrarDemo();
    await sembrarDemo();

    const admins = await db
      .selectFrom("User")
      .selectAll()
      .where("email", "=", "admin@example.com")
      .execute();
    expect(admins).toHaveLength(1);
  });
});
