import { readFileSync } from "node:fs";
import path from "node:path";
import { cuidParamSchema } from "@plataforma/shared";
import { afterEach, describe, expect, it } from "vitest";
import { MIGRATIONS_DIR } from "../src/db/migrate.js";
import { createClient } from "../src/lib/libsql-client.js";

const SQL_MIGRACION = readFileSync(
  path.join(MIGRATIONS_DIR, "0013_dossier_por_cada_venta.sql"),
  "utf-8"
);

let client: ReturnType<typeof createClient> | undefined;

afterEach(() => {
  client?.close();
  client = undefined;
});

async function base() {
  const c = createClient({ url: ":memory:" });
  await c.execute(
    "CREATE TABLE Unit (id text PRIMARY KEY NOT NULL, investorId text, updatedAt integer NOT NULL)"
  );
  await c.execute(`
    CREATE TABLE Dossier (
      id text PRIMARY KEY NOT NULL,
      unitId text NOT NULL,
      masterHash text NOT NULL,
      compiledAt integer NOT NULL,
      shareToken text,
      status text DEFAULT 'compiled' NOT NULL,
      signedById text,
      signedAt integer,
      rejectionNote text
    )
  `);
  await c.execute("CREATE UNIQUE INDEX Dossier_unitId_key ON Dossier (unitId)");
  client = c;
  return c;
}

const dossiers = async (c: Awaited<ReturnType<typeof base>>) =>
  (await c.execute("SELECT * FROM Dossier ORDER BY unitId")).rows;

describe("migración 0013 — cada venta tiene su dossier", () => {
  it("le da un dossier a la unidad vendida que no lo tenía, como lo haría la aceptación", async () => {
    const c = await base();
    await c.execute("INSERT INTO Unit VALUES ('vendida', 'investor-1', 1700000000000)");

    await c.execute(SQL_MIGRACION);

    const [fila] = await dossiers(c);
    expect(fila).toMatchObject({
      unitId: "vendida",
      masterHash: "",
      compiledAt: 1700000000000,
      status: "compiled",
      signedById: null,
      shareToken: null
    });
    expect(cuidParamSchema.safeParse(fila?.id).success).toBe(true);
  });

  it("no toca la unidad sin investor ni el dossier que ya existía", async () => {
    const c = await base();
    await c.execute("INSERT INTO Unit VALUES ('libre', NULL, 1)");
    await c.execute("INSERT INTO Unit VALUES ('firmada', 'investor-1', 1)");
    await c.execute(
      "INSERT INTO Dossier (id, unitId, masterHash, compiledAt, status, signedById) VALUES ('d-firmado', 'firmada', 'h', 5, 'signed', 'notario')"
    );

    await c.execute(SQL_MIGRACION);

    expect(await dossiers(c)).toEqual([
      expect.objectContaining({ id: "d-firmado", masterHash: "h", status: "signed" })
    ]);
  });

  it("corrida dos veces (regla 8): la segunda no agrega nada", async () => {
    const c = await base();
    await c.execute("INSERT INTO Unit VALUES ('u1', 'investor-1', 1)");
    await c.execute("INSERT INTO Unit VALUES ('u2', 'investor-2', 2)");

    await c.execute(SQL_MIGRACION);
    const primera = await dossiers(c);
    await c.execute(SQL_MIGRACION);

    expect(await dossiers(c)).toEqual(primera);
    expect(primera).toHaveLength(2);
  });
});
