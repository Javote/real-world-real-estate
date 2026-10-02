import { vi } from "vitest";

type CompiledQuery = { sql: string };

type Metodo = (...args: unknown[]) => Promise<unknown>;
type Prototipo = Record<string, Metodo>;

// El mismo módulo CJS que carga `src/lib/libsql-dialect.ts`, y su `@libsql/client` (no el de la API):
// espiar estos prototipos es espiar al driver y al cliente reales.
const { LibsqlConnection, libsql } = require("@libsql/kysely-libsql") as {
  LibsqlConnection: { prototype: Prototipo };
  libsql: { createClient(config: { url: string }): { close(): void } };
};

// `enLote` llama a `client.batch` sin pasar por la conexión de Kysely: la clase del cliente se saca
// de una sonda con la misma URL que usa `db`.
function prototipoDelCliente(): Prototipo {
  const sonda = libsql.createClient({ url: process.env.DATABASE_URL as string });
  const prototipo = Object.getPrototypeOf(sonda) as Prototipo;
  sonda.close();
  return prototipo;
}

type Viaje = { sql: string; inicio: number; fin: number };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cuántos viajes a la base paga `fn` en serie. Cada consulta, cada COMMIT y cada `batch` (los dos,
 * sobre HTTP, un viaje propio) tarda `demoraMs` de más; la profundidad es la cadena más larga de
 * viajes donde cada uno empieza después de que terminó el anterior. Los que van en `Promise.all`
 * cuentan una vez.
 */
export async function medirViajes(fn: () => Promise<unknown>, demoraMs = 15) {
  const viajes: Viaje[] = [];

  const envolver = (prototipo: Prototipo, metodo: string, sql: (args: unknown[]) => string) => {
    const original = prototipo[metodo] as Metodo;
    return vi.spyOn(prototipo, metodo).mockImplementation(async function (
      this: unknown,
      ...args: unknown[]
    ) {
      const viaje = { sql: sql(args), inicio: performance.now(), fin: Number.POSITIVE_INFINITY };
      viajes.push(viaje);
      await esperar(demoraMs);
      try {
        return await original.apply(this, args);
      } finally {
        viaje.fin = performance.now();
      }
    });
  };

  const espias = [
    envolver(LibsqlConnection.prototype, "executeQuery", ([q]) => (q as CompiledQuery).sql),
    envolver(LibsqlConnection.prototype, "commitTransaction", () => "COMMIT"),
    envolver(prototipoDelCliente(), "batch", ([lote]) => `BATCH(${(lote as unknown[]).length})`)
  ];

  try {
    await fn();
  } finally {
    for (const espia of espias) espia.mockRestore();
  }

  const profundidad = new Map<Viaje, number>();
  for (const viaje of [...viajes].sort((a, b) => a.inicio - b.inicio)) {
    const previos = viajes.filter((p) => p.fin <= viaje.inicio).map((p) => profundidad.get(p) ?? 0);
    profundidad.set(viaje, 1 + Math.max(0, ...previos));
  }

  return {
    enSerie: Math.max(0, ...profundidad.values()),
    consultas: viajes.length,
    sql: viajes.map((v) => v.sql)
  };
}
