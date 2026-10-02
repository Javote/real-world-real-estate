// ESM puro en un package CommonJS: `require()` en runtime (Node 24) tipado con `resolution-mode`.
const kyselyModule = require("kysely") as typeof import("kysely", { with: {
  "resolution-mode": "require"
}});

export const Kysely = kyselyModule.Kysely;
export const sql = kyselyModule.sql;

export type { Kysely as KyselyDb } from "kysely" with { "resolution-mode": "require" };

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
  UnknownRow,
  Updateable
} from "kysely" with { "resolution-mode": "require" };
