import { vi } from "vitest";

type CompiledQuery = { sql: string };

type Conexion = {
  executeQuery(q: CompiledQuery): Promise<unknown>;
  commitTransaction(): Promise<void>;
};

// El mismo módulo CJS que carga `src/lib/libsql-dialect.ts`: espiar su prototipo es espiar al driver real.
const { LibsqlConnection } = require("@libsql/kysely-libsql") as {
  LibsqlConnection: { prototype: Conexion };
};

type Viaje = { sql: string; inicio: number; fin: number };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cuántos viajes a la base paga `fn` en serie. Cada consulta (y cada COMMIT, que sobre HTTP es un
 * viaje propio) tarda `demoraMs` de más; la profundidad es la cadena más larga de viajes donde cada
 * uno empieza después de que terminó el anterior. Los que van en `Promise.all` cuentan una vez.
 */
export async function medirViajes(fn: () => Promise<unknown>, demoraMs = 15) {
  const viajes: Viaje[] = [];

  const envolver = <K extends keyof Conexion>(metodo: K, sql: (args: unknown[]) => string) => {
    const original = LibsqlConnection.prototype[metodo] as (...args: unknown[]) => Promise<unknown>;
    return vi.spyOn(LibsqlConnection.prototype, metodo).mockImplementation(async function (
      this: Conexion,
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
    } as never);
  };

  const espias = [
    envolver("executeQuery", ([q]) => (q as CompiledQuery).sql),
    envolver("commitTransaction", () => "COMMIT")
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
