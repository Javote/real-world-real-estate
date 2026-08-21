import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// D-048: destino Drizzle + `@libsql/client` (D-038, Turso en prod). El dialect
// `turso` es el que drizzle-kit usa para libSQL, tanto `file:` local como
// `libsql://` remoto.
export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
    authToken: process.env.DATABASE_AUTH_TOKEN
  }
});
