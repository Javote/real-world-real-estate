import { SqliteAdapter } from "./kysely";

// ESM puro en un package CommonJS: `require()` en runtime (Node 24) tipado con `resolution-mode`.
const libsqlDialectModule =
  require("@libsql/kysely-libsql") as typeof import("@libsql/kysely-libsql", { with: {
    "resolution-mode": "require"
  }});

// Con `false`, Kysely pone un mutex global y cada consulta del proceso espera a la anterior. Contra
// libSQL no protege nada: cada conexión es independiente y cada transacción abre su propio stream.
class LibsqlAdapter extends SqliteAdapter {
  override get supportsMultipleConnections() {
    return true;
  }
}

export class LibsqlDialect extends libsqlDialectModule.LibsqlDialect {
  override createAdapter() {
    return new LibsqlAdapter();
  }
}
