// Mismo patrón que `lib/kysely.ts`: `@libsql/kysely-libsql` es ESM puro.
const libsqlDialectModule = require("@libsql/kysely-libsql") as typeof import(
  "@libsql/kysely-libsql",
  { with: { "resolution-mode": "require" } }
);

export const LibsqlDialect = libsqlDialectModule.LibsqlDialect;
