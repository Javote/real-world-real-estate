import type {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  UnknownRow
} from "../lib/kysely";

// SQLite no tiene tipos nativos de boolean/timestamp: los guarda como
// `integer` (0/1, epoch ms) y `@libsql/client` los devuelve tal cual —
// `number`, no `Date`/`boolean`. Drizzle resolvía esto con `mode: "boolean"` /
// `mode: "timestamp_ms"` en el schema (D-048); Kysely no tiene equivalente,
// así que se centraliza acá vía plugin en vez de convertir a mano en cada
// ruta. Al insertar/actualizar no hace falta la inversa: `@libsql/client`
// acepta `Date`/`boolean` directo como `InValue` (los convierte él).
const TIMESTAMP_COLUMNS = new Set([
  "createdAt",
  "updatedAt",
  "certifiedAt",
  "estimatedDelivery",
  "uploadedAt"
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
