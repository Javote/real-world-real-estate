// `kysely` se publica solo como ESM (`"type": "module"`, sin condición
// `require` en su package.json) — mismo problema que `@paralleldrive/cuid2`
// y `@libsql/client` con `moduleResolution: node16` en un package CJS (ver
// Trampas de `packages/api/CLAUDE.md`). Se resuelve igual: `require()` en
// runtime (Node 24 sabe cargar un ESM puro de forma síncrona,
// `require(esm)`, estable desde ~22.12) tipado con
// `typeof import("kysely", { with: { "resolution-mode": "require" } })`, que
// le da a este `require()` el tipo completo del módulo — clases, funciones y
// tipos — sin repetir el patrón en cada archivo que usa Kysely.
const kyselyModule = require("kysely") as typeof import("kysely", {
  with: { "resolution-mode": "require" }
});

export const Kysely = kyselyModule.Kysely;
export const sql = kyselyModule.sql;

export type {
  ColumnType,
  ExpressionBuilder,
  ExpressionWrapper,
  Generated,
  Insertable,
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  Selectable,
  SqlBool,
  Updateable,
  UnknownRow
} from "kysely" with { "resolution-mode": "require" };
