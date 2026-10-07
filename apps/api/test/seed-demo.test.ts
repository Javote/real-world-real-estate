import bcrypt from "bcrypt";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sembrarDemo } from "../src/db/seed.js";
import { sembrarDemoProduccion } from "../src/db/seed-produccion.js";
import { db } from "../src/lib/db.js";

const ADMIN_PROD = "una password valida y larga 1";
const DEMO_PROD = "otra password valida y larga 2";
const CON_PASSWORDS = { SEED_ADMIN_PASSWORD: ADMIN_PROD, SEED_DEMO_PASSWORD: DEMO_PROD };

const hashDe = async (email: string) =>
  (
    await db
      .selectFrom("User")
      .select("passwordHash")
      .where("email", "=", email)
      .executeTakeFirstOrThrow()
  ).passwordHash;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sembrarDemo — el seed local", () => {
  it("arma el mundo completo", async () => {
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

  it("ignora SEED_* del entorno: siembra siempre las passwords del repo", async () => {
    await sembrarDemo({ ...process.env, ...CON_PASSWORDS });

    expect(await bcrypt.compare("admin123", await hashDe("admin@example.com"))).toBe(true);
    expect(await bcrypt.compare("developer123", await hashDe("developer@example.com"))).toBe(true);
    expect(await bcrypt.compare(ADMIN_PROD, await hashDe("admin@example.com"))).toBe(false);
  });

  it("se niega contra una base que no es un SQLite en disco, antes de escribir nada", async () => {
    const antes = await hashDe("admin@example.com");

    await expect(
      sembrarDemo({ ...process.env, DATABASE_URL: "libsql://propnexus.turso.io" })
    ).rejects.toThrow(/seed local/);
    expect(await hashDe("admin@example.com")).toBe(antes);
  });

  it("es idempotente", async () => {
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

describe("sembrarDemoProduccion — la demo desplegada", () => {
  it("siembra las passwords del entorno, y reescribe el hash si ya existía", async () => {
    await sembrarDemo();
    await sembrarDemoProduccion({ ...process.env, ...CON_PASSWORDS });

    expect(await bcrypt.compare(ADMIN_PROD, await hashDe("admin@example.com"))).toBe(true);
    expect(await bcrypt.compare(DEMO_PROD, await hashDe("notary@example.com"))).toBe(true);
    expect(await bcrypt.compare("admin123", await hashDe("admin@example.com"))).toBe(false);
  });

  it("sin las variables revienta antes de escribir nada", async () => {
    const antes = await hashDe("admin@example.com");

    await expect(
      sembrarDemoProduccion({ ...process.env, SEED_ADMIN_PASSWORD: "", SEED_DEMO_PASSWORD: "" })
    ).rejects.toThrow(/SEED_ADMIN_PASSWORD/);
    expect(await hashDe("admin@example.com")).toBe(antes);
  });

  it("NUNCA imprime una password", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await sembrarDemoProduccion({ ...process.env, ...CON_PASSWORDS });

    const salida = log.mock.calls.flat().join("\n");
    expect(salida).not.toContain(ADMIN_PROD);
    expect(salida).not.toContain(DEMO_PROD);
    expect(salida).toContain("(desde SEED_ADMIN_PASSWORD)");
  });
});
