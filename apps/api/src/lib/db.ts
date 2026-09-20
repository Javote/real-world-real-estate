import { asegurarDirectorioLocal, DEFAULT_DATABASE_URL } from "../db/local-db";
import { SqliteTypeCoercionPlugin } from "../db/sqlite-type-plugin";
import type { Database } from "../db/types";
import { Kysely } from "./kysely";
import { LibsqlDialect } from "./libsql-dialect";

// `@libsql/client` habla `file:` locales igual que `libsql://` remotos: un
// solo driver sirve para dev (SQLite en disco) y prod (Turso, D-038), sin
// adaptador aparte. `authToken` queda undefined contra un `file:` local, que
// es exactamente lo que espera el cliente.
//
// Se pasa `{ url, authToken }` en vez de un `Client` ya construido: dejar que
// `LibsqlDialect` cree el suyo evita un choque de tipos entre la versión de
// `@libsql/client` que usa este package (`^0.17.4`, vía `lib/libsql-client.ts`)
// y la que trae como dependencia `@libsql/kysely-libsql` (`^0.8.0`) — pnpm
// instala las dos sin dedupear porque los rangos no se solapan, y el `Client`
// de una no tipa contra el `Client` de la otra. `db.destroy()` sí cierra la
// conexión en este modo (Kysely es dueño del cliente que crea).
const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
asegurarDirectorioLocal(databaseUrl);

export const db = new Kysely<Database>({
  // SPEC-208 (B-12): con `exactOptionalPropertyTypes`, `authToken: undefined`
  // explícito ya no es lo mismo que omitirlo.
  dialect: new LibsqlDialect({
    url: databaseUrl,
    ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {})
  }),
  plugins: [new SqliteTypeCoercionPlugin()]
});
