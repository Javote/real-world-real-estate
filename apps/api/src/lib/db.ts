import { asegurarDirectorioLocal, urlDeLaBase } from "../db/local-db";
import { coerceRow, SqliteTypeCoercionPlugin } from "../db/sqlite-type-plugin";
import type { Database } from "../db/types";
import { type Compilable, Kysely } from "./kysely";
import { LibsqlDialect } from "./libsql-dialect";

const databaseUrl = urlDeLaBase();
asegurarDirectorioLocal(databaseUrl);

const dialecto = new LibsqlDialect({
  url: databaseUrl,
  ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {})
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
