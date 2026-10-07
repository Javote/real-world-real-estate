import { asegurarDirectorioLocal, urlDeLaBase } from "../db/local-db.js";
import { coerceRow, SqliteTypeCoercionPlugin } from "../db/sqlite-type-plugin.js";
import type { Database } from "../db/types.js";
import { entorno } from "../platform/config.js";
import { type Compilable, Kysely } from "./kysely.js";
import { LibsqlDialect } from "./libsql-dialect.js";

const databaseUrl = urlDeLaBase();
asegurarDirectorioLocal(databaseUrl);

const { DATABASE_AUTH_TOKEN } = entorno();

const dialecto = new LibsqlDialect({
  url: databaseUrl,
  ...(DATABASE_AUTH_TOKEN ? { authToken: DATABASE_AUTH_TOKEN } : {})
});

export const db = new Kysely<Database>({
  dialect: dialecto,
  plugins: [new SqliteTypeCoercionPlugin()]
});

type FilasDe<T> = { [K in keyof T]: T[K] extends Compilable<infer O> ? O[] : never };

// Varias escrituras en un solo viaje y en una sola transacción (`batch` de libSQL en modo `write`):
// entran todas o ninguna. Una transacción interactiva cuesta un viaje por sentencia más el COMMIT.
// Las filas vuelven con los mismos tipos que devuelve Kysely.
export async function enLote<const T extends readonly Compilable<unknown>[]>(
  ...consultas: T
): Promise<FilasDe<T>> {
  const resultados = await dialecto.cliente.batch(
    consultas.map((consulta) => {
      const { sql, parameters } = consulta.compile();
      return { sql, args: parameters as never };
    }),
    "write"
  );

  return resultados.map((resultado) => resultado.rows.map(coerceRow)) as FilasDe<T>;
}
