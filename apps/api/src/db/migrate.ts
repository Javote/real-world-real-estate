import "dotenv/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type Client, createClient } from "../lib/libsql-client.js";
import { esPuntoDeEntrada } from "../lib/punto-de-entrada.js";
import { entorno } from "../platform/config.js";
import { esBaseLocal } from "./credentials.js";
import { asegurarDirectorioLocal, urlDeLaBase } from "./local-db.js";

export const MIGRATIONS_DIR = (() => {
  const candidatos = [
    path.join(import.meta.dirname, "..", "..", "migrations"),
    path.join(import.meta.dirname, "..", "..", "..", "migrations")
  ];
  const encontrado = candidatos.find((dir) => existsSync(dir));
  if (!encontrado) {
    throw new Error(
      `No encuentro el directorio de migraciones. Probé:\n  ${candidatos.join("\n  ")}`
    );
  }
  return encontrado;
})();

export async function applyPendingMigrations(
  client: Client,
  migrationsDir: string = MIGRATIONS_DIR
): Promise<string[]> {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY NOT NULL, appliedAt integer NOT NULL)"
  );

  const applied = new Set(
    (await client.execute("SELECT name FROM _migrations")).rows.map((row) => row.name as string)
  );

  const aplicadas: string[] = [];

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    await client.batch(
      [
        ...statements,
        {
          sql: "INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)",
          args: [file, Date.now()]
        }
      ],
      "write"
    );

    aplicadas.push(file);
  }

  return aplicadas;
}

const TECHO_MS = 120_000;

export async function conTecho<T>(
  promesa: Promise<T>,
  queEsperaba: string,
  ms: number = TECHO_MS
): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promesa,
      new Promise<never>((_, rechazar) => {
        reloj = setTimeout(
          () => rechazar(new Error(`${queEsperaba} no respondió en ${ms / 1000}s`)),
          ms
        );
      })
    ]);
  } finally {
    /* v8 ignore if -- @preserve: el executor de `new Promise(...)` corre sincrónico, así que `reloj` ya está asignado en cualquier camino que llegue a este `finally` */
    if (reloj) clearTimeout(reloj);
  }
}

export async function migrar(url: string = urlDeLaBase()): Promise<string[]> {
  asegurarDirectorioLocal(url);

  console.log("[migrate] conectando a la base");

  const { DATABASE_AUTH_TOKEN } = entorno();
  const client = createClient({
    url,
    ...(DATABASE_AUTH_TOKEN ? { authToken: DATABASE_AUTH_TOKEN } : {})
  });

  const aplicadas = await conTecho(applyPendingMigrations(client), "la base");

  for (const file of aplicadas) {
    console.log(`Applied ${file}`);
  }

  console.log(
    aplicadas.length === 0
      ? "[migrate] sin migraciones pendientes"
      : `[migrate] ${aplicadas.length} migración(es) aplicada(s)`
  );

  client.close();

  return aplicadas;
}

export async function migrarSoloLocal(url: string = urlDeLaBase()): Promise<string[] | null> {
  if (!esBaseLocal(url)) {
    console.log("[migrate] la base no es local: pnpm dev no la migra");
    return null;
  }
  return migrar(url);
}

/* v8 ignore if -- @preserve: guardia para que importar el módulo no migre; solo corre como CLI */
if (esPuntoDeEntrada(import.meta.url)) {
  (process.argv.includes("--solo-local") ? migrarSoloLocal() : migrar()).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
