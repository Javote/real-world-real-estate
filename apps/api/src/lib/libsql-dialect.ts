// ESM puro en un package CommonJS: `require()` en runtime (Node 24) tipado con `resolution-mode`.
const libsqlDialectModule =
  require("@libsql/kysely-libsql") as typeof import("@libsql/kysely-libsql", { with: {
    "resolution-mode": "require"
  }});

export const LibsqlDialect = libsqlDialectModule.LibsqlDialect;
