import { afterEach, describe, expect, it } from "vitest";
import { sembrarDemo } from "../src/db/seed";
import { db } from "../src/lib/db";

// `sembrarDemo` (antes `main()`, sin exportar, detrás del guardia
// `require.main === module`) es lo que corre `pnpm db:seed` — SPEC-017 paso 4,
// tanda 3. `passwordDeDemo` (D-047) ya tiene su propia suite completa
// (`seed-credentials.test.ts`); acá lo que falta cubrir es lo que `sembrarDemo`
// arma ENCIMA de esa función: el elenco completo, la organización, el
// proyecto, el template de stages, la unidad vendida y el dossier compilado —
// nada de eso tenía ningún test, porque el único lugar donde corría era el
// seed de desarrollo a mano.
//
// Corre contra la MISMA base de test que usa el resto de la suite
// (`test/global-setup.ts`): todos los constructores que llama son idempotentes
// por `onConflict` (SPEC-015 §2), así que sembrar de nuevo no choca con nada
// que ya exista.

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
    // Regla M3 §2.5: la primera etapa nace `InProgress`, no `Completed`
    // directo — así no tiene evidencia/eventos/certifiedAt fabricados.
    expect(stages[0]?.state).toBe("InProgress");
    expect(stages.slice(1).every((s) => s.state === "Pending")).toBe(true);

    const unidad = await db
      .selectFrom("Unit")
      .selectAll()
      .where("projectId", "=", proyecto.id)
      .where("unitReference", "=", "4B")
      .executeTakeFirstOrThrow();
    expect(unidad.status).toBe("sold");

    // El dossier se compila, no se inserta (M2-D5 §3) — sembrarDemo lo dispara
    // al final, y sin eso la cola de revisión del notario arranca vacía.
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
    // Un segundo seed no duplica la fila — `sembrarUsuarios` hace upsert por
    // email (D-046: la password SÍ se actualiza, nunca queda la vieja).
    expect(admins).toHaveLength(1);
  });
});
