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

type LibsqlDriver = InstanceType<typeof libsqlDialectModule.LibsqlDriver>;

export class LibsqlDialect extends libsqlDialectModule.LibsqlDialect {
  #driver?: LibsqlDriver;

  override createAdapter() {
    return new LibsqlAdapter();
  }

  override createDriver() {
    this.#driver = super.createDriver() as LibsqlDriver;
    return this.#driver;
  }

  // El cliente del driver que Kysely crea en su constructor: misma conexión y misma versión de
  // `@libsql/client` que las consultas, y `db.destroy()` lo sigue cerrando.
  get cliente(): LibsqlDriver["client"] {
    return this.#driver!.client;
  }
}
