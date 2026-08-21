import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "../lib/libsql-client";

// Kysely no trae generador de migraciones (D-049): las de `drizzle/*.sql` son
// SQL plano heredado de cuando las generaba `drizzle-kit generate` (D-048) —
// siguen siendo la fuente real, solo dejan de regenerarse desde un schema de
// ORM. Una migración nueva se escribe a mano en `drizzle/`, con el mismo
// separador `--> statement-breakpoint` entre statements que ya usaban los
// archivos existentes (no es sintaxis de Kysely, es una convención de archivo
// plano para poder tener más de un `CREATE TABLE` por migración).
//
// El tracking de qué migración ya corrió es propio (tabla `_migrations`), no
// heredado de `__drizzle_migrations`: no hay ninguna base con datos reales
// todavía (sin deploy, D-041), así que no hay nada que migrar de un esquema
// de tracking al otro.
const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "drizzle");

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN
  });

  await client.execute(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY NOT NULL, appliedAt integer NOT NULL)"
  );

  const applied = new Set(
    (await client.execute("SELECT name FROM _migrations")).rows.map((row) => row.name as string)
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      await client.execute(statement);
    }

    await client.execute({
      sql: "INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)",
      args: [file, Date.now()]
    });

    console.log(`Applied ${file}`);
  }

  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
