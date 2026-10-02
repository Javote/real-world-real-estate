import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let previoDatabaseUrl: string | undefined;
let previoAuthToken: string | undefined;

beforeEach(() => {
  previoDatabaseUrl = process.env.DATABASE_URL;
  previoAuthToken = process.env.DATABASE_AUTH_TOKEN;
});

afterEach(() => {
  if (previoDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previoDatabaseUrl;
  if (previoAuthToken === undefined) delete process.env.DATABASE_AUTH_TOKEN;
  else process.env.DATABASE_AUTH_TOKEN = previoAuthToken;
  vi.doUnmock("node:fs");
  vi.doUnmock("../src/lib/libsql-client");
  vi.resetModules();
});

describe("MIGRATIONS_DIR", () => {
  it("sin ningún directorio candidato, tira apenas se importa el módulo", async () => {
    vi.resetModules();
    vi.doMock("node:fs", async () => {
      const real = await vi.importActual<typeof import("node:fs")>("node:fs");
      return { ...real, existsSync: () => false };
    });

    await expect(import("../src/db/migrate.js")).rejects.toThrow(
      /No encuentro el directorio de migraciones/
    );
  });
});

describe("migrar — la URL y el token que le llegan al cliente", () => {
  function clienteFalso() {
    return {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      batch: vi.fn().mockResolvedValue(undefined),
      close: vi.fn()
    };
  }

  it("sin DATABASE_URL, conecta contra el DEFAULT_DATABASE_URL, sin authToken", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_AUTH_TOKEN;

    const createClient = vi.fn().mockReturnValue(clienteFalso());
    vi.doMock("../src/lib/libsql-client", () => ({ createClient }));
    vi.resetModules();

    const { migrar } = await import("../src/db/migrate.js");
    const { DEFAULT_DATABASE_URL } = await import("../src/db/local-db.js");

    await migrar();

    expect(createClient).toHaveBeenCalledTimes(1);
    const config = createClient.mock.calls[0]?.[0];
    expect(config).toMatchObject({ url: DEFAULT_DATABASE_URL });
    expect(config).not.toHaveProperty("authToken");
  });

  it("con DATABASE_AUTH_TOKEN, lo pasa al cliente junto con la URL", async () => {
    process.env.DATABASE_URL = "libsql://coverage-test.turso.io";
    process.env.DATABASE_AUTH_TOKEN = "el-token-de-turso";

    const createClient = vi.fn().mockReturnValue(clienteFalso());
    vi.doMock("../src/lib/libsql-client", () => ({ createClient }));
    vi.resetModules();

    const { migrar } = await import("../src/db/migrate.js");
    await migrar();

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "libsql://coverage-test.turso.io",
        authToken: "el-token-de-turso"
      })
    );
  });
});
