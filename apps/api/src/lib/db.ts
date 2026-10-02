import { asegurarDirectorioLocal, urlDeLaBase } from "../db/local-db";
import { SqliteTypeCoercionPlugin } from "../db/sqlite-type-plugin";
import type { Database } from "../db/types";
import { Kysely } from "./kysely";
import { LibsqlDialect } from "./libsql-dialect";

const databaseUrl = urlDeLaBase();
asegurarDirectorioLocal(databaseUrl);

export const db = new Kysely<Database>({
  dialect: new LibsqlDialect({
    url: databaseUrl,
    ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {})
  }),
  plugins: [new SqliteTypeCoercionPlugin()]
});
