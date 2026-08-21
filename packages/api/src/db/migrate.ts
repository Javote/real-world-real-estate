import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "../lib/libsql-client";

// Equivalente a `prisma migrate deploy`: aplica las migraciones commiteadas en
// `drizzle/` contra `DATABASE_URL`, sin generar nada nuevo. Lo usan tanto
// `pnpm db:migrate` como `test/global-setup.ts` (contra `file:./test.db`).
async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN
  });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: "./drizzle" });
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
