import type {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  UnknownRow
} from "../lib/kysely";

const TIMESTAMP_COLUMNS = new Set([
  "createdAt",
  "updatedAt",
  "certifiedAt",
  "estimatedDelivery",
  "uploadedAt",
  "blockTimestamp",
  "coverUpdatedAt"
]);

const BOOLEAN_COLUMNS = new Set(["isActive", "authoritative", "validationCritical"]);

function coerceRow(row: UnknownRow): UnknownRow {
  const out: UnknownRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== null && TIMESTAMP_COLUMNS.has(key) && typeof value === "number") {
      out[key] = new Date(value);
    } else if (value !== null && BOOLEAN_COLUMNS.has(key) && typeof value === "number") {
      out[key] = value === 1;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export class SqliteTypeCoercionPlugin implements KyselyPlugin {
  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return args.node;
  }

  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return {
      ...args.result,
      rows: args.result.rows.map(coerceRow)
    };
  }
}
