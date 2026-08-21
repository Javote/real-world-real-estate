import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { createClient } from "./libsql-client";

// `@libsql/client` habla `file:` locales igual que `libsql://` remotos: un
// solo driver sirve para dev (SQLite en disco) y prod (Turso, D-038), sin
// adaptador aparte. `authToken` queda undefined contra un `file:` local, que
// es exactamente lo que espera el cliente.
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.DATABASE_AUTH_TOKEN
});

export const db = drizzle(client, { schema });
