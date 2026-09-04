import "dotenv/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type Client, createClient } from "../lib/libsql-client";
import { asegurarDirectorioLocal, DEFAULT_DATABASE_URL } from "./local-db";

// Kysely no trae generador de migraciones (D-049): `migrations/*.sql` es SQL
// plano que se escribe a mano, con `--> statement-breakpoint` entre statements
// (convención de archivo, no sintaxis de Kysely: permite más de un statement
// por archivo). El tracking de qué corrió es propio — tabla `_migrations`.
//
// **Este archivo es el único lugar donde se aplican migraciones** (D-052). La
// suite de tests lo importa en vez de repetir el parser: mientras estuvieron
// duplicados, cualquier cambio de formato había que acordarse de hacerlo dos
// veces, y los tests dejaban de verificar lo que corre en producción — que es
// justamente lo único que justifica aplicar las migraciones reales en la suite.
//
// La ruta se resuelve buscando, no fijando: `tsx` corre desde `src/db/` y el
// build corre desde `dist/src/db/`, así que una sola constante relativa no
// puede servir a los dos. Con `../../migrations` a secas, el `db:migrate`
// compilado apuntaba a `dist/migrations`, que no existe — y el `startCommand`
// de Render corre el compilado, donde el free tier no da shell para ir a ver
// por qué falló.
export const MIGRATIONS_DIR = (() => {
  const candidatos = [
    path.join(__dirname, "..", "..", "migrations"), // tsx:   src/db      → apps/api
    path.join(__dirname, "..", "..", "..", "migrations") // build: dist/src/db → apps/api
  ];
  const encontrado = candidatos.find((dir) => existsSync(dir));
  if (!encontrado) {
    throw new Error(
      `No encuentro el directorio de migraciones. Probé:\n  ${candidatos.join("\n  ")}`
    );
  }
  return encontrado;
})();

/**
 * Aplica las migraciones que falten y devuelve los nombres de las que aplicó.
 *
 * Idempotente: re-ejecutarla no duplica efectos (regla 8), que es lo que
 * permite ponerla en el `startCommand` de Render — en free tier no hay shell
 * ni one-off jobs para correrla aparte (D-012, D-040).
 */
export async function applyPendingMigrations(client: Client): Promise<string[]> {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY NOT NULL, appliedAt integer NOT NULL)"
  );

  const applied = new Set(
    (await client.execute("SELECT name FROM _migrations")).rows.map((row) => row.name as string)
  );

  const aplicadas: string[] = [];

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      await client.execute(statement);
    }

    await client.execute({
      sql: "INSERT INTO _migrations (name, appliedAt) VALUES (?, ?)",
      args: [file, Date.now()]
    });

    aplicadas.push(file);
  }

  return aplicadas;
}

/**
 * Techo de tiempo para la migración entera, **incluida la conexión**.
 *
 * El 2026-09-04 un deploy de la API se colgó acá: el build salió bien, el
 * `startCommand` arrancó, y el proceso no abrió un puerto en catorce minutos
 * hasta que Render lo dio por muerto por *port scan timeout*. Sin techo, una
 * base que no responde no falla — **se queda esperando**, y consume el margen
 * entero de la plataforma antes de que nadie se entere.
 *
 * 120s es holgado a propósito: un arranque sano tarda ~5s contra Turso, así que
 * hay 24× de margen y el techo no puede cortar una migración lenta pero viva.
 * Lo que compra es que el modo de falla pase de catorce minutos de silencio a
 * dos minutos con una línea que dice qué pasó.
 */
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
    if (reloj) clearTimeout(reloj);
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  asegurarDirectorioLocal(url);

  // **Estas dos líneas existen para que el silencio se pueda leer.** El
  // `startCommand` de Render son dos pasos —`migrate && server`— y hasta hoy
  // ninguno anunciaba que había empezado: un arranque colgado adentro de la
  // migración y uno colgado adentro del servidor producían exactamente el mismo
  // log vacío, y el free tier no da shell para ir a mirar.
  console.log("[migrate] conectando a la base");

  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN
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
}

// Solo corre como script. Sin este guardia, importarlo desde la suite de tests
// dispararía una migración contra la base local como efecto secundario del import.
if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
