import bcrypt from "bcrypt";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sembrarSoloAdmin } from "../src/db/seed-admin.js";
import { db } from "../src/lib/db.js";

const EMAIL = "admin-mainnet@propnexus.test";
const PASSWORD = "una password valida y larga 3";
const ENV = { ...process.env, SEED_ADMIN_EMAIL: EMAIL, SEED_ADMIN_PASSWORD: PASSWORD };

const usuario = () =>
  db.selectFrom("User").selectAll().where("email", "=", EMAIL).executeTakeFirst();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sembrarSoloAdmin — una base que arranca vacía", () => {
  it("crea el admin con la password del entorno, y nada más", async () => {
    const proyectosAntes = await db.selectFrom("Project").select("id").execute();

    await sembrarSoloAdmin(ENV);

    const admin = await usuario();
    expect(admin?.role).toBe("admin");
    expect(admin?.isActive).toBe(true);
    expect(await bcrypt.compare(PASSWORD, admin?.passwordHash ?? "")).toBe(true);
    expect(await db.selectFrom("Project").select("id").execute()).toEqual(proyectosAntes);
  });

  it("es idempotente: sembrar de nuevo reescribe la password, no duplica", async () => {
    await sembrarSoloAdmin(ENV);
    await sembrarSoloAdmin({ ...ENV, SEED_ADMIN_PASSWORD: "otra password valida y larga 4" });

    const admins = await db
      .selectFrom("User")
      .select("passwordHash")
      .where("email", "=", EMAIL)
      .execute();
    expect(admins).toHaveLength(1);
    expect(
      await bcrypt.compare("otra password valida y larga 4", admins[0]?.passwordHash ?? "")
    ).toBe(true);
  });

  it.each([
    ["sin email", { ...ENV, SEED_ADMIN_EMAIL: "" }, /SEED_ADMIN_EMAIL/],
    ["con un email inválido", { ...ENV, SEED_ADMIN_EMAIL: "admin" }, /SEED_ADMIN_EMAIL/],
    ["sin password", { ...ENV, SEED_ADMIN_PASSWORD: "" }, /SEED_ADMIN_PASSWORD/]
  ])("%s revienta antes de escribir nada", async (_caso, env, error) => {
    await db.deleteFrom("User").where("email", "=", EMAIL).execute();

    await expect(sembrarSoloAdmin(env)).rejects.toThrow(error);
    expect(await usuario()).toBeUndefined();
  });

  it("NUNCA imprime la password", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await sembrarSoloAdmin(ENV);

    const salida = log.mock.calls.flat().join("\n");
    expect(salida).not.toContain(PASSWORD);
    expect(salida).toContain(EMAIL);
  });
});
