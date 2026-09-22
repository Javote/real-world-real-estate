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
 *
 * `migrationsDir` es opcional y por default es {@link MIGRATIONS_DIR} — el
 * único motivo por el que existe el parámetro es que SPEC-203 necesita
 * probar "un statement falla a mitad de archivo" con un archivo temporal,
 * sin escribirlo dentro de `migrations/` (que comparten todos los tests que
 * arrancan una base nueva en paralelo).
 */
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

    // SPEC-203 (B-03): un solo `client.batch(..., "write")` en vez del `for`
    // de antes. Antes, un archivo de 43 statements que fallaba en el número
    // 20 dejaba los 19 anteriores aplicados y el archivo SIN marcar en
    // `_migrations` — el próximo arranque volvía a correr `CREATE TABLE
    // User` y moría con "table already exists", **para siempre, sin
    // intervención manual** (el free tier de Render no da shell, D-040). SQLite
    // soporta DDL transaccional y `batch` lo corre así: o entran los N
    // statements del archivo Y la fila de `_migrations`, o no entra ninguno.
    // La fila va en el MISMO batch — no después — porque separarla reabriría
    // la misma ventana que este cambio cierra.
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

/**
 * Lo que corre `pnpm db:migrate` y el `startCommand` de Render: conecta,
 * aplica lo pendiente con el techo de `conTecho`, loguea y cierra.
 *
 * Exportada (SPEC-017 paso 4, tanda 3) para que un test la invoque contra una
 * base propia, en vez de solo probar `applyPendingMigrations`/`conTecho` por
 * separado — lo que este archivo agrega encima de esas dos (conectar con la
 * URL correcta, cerrar el cliente, los mensajes de log) no tenía ningún test.
 * `url` es parámetro y no siempre `process.env.DATABASE_URL` por la misma
 * razón que `migrationsDir` es parámetro de `applyPendingMigrations`: un test
 * necesita apuntar a su propia base sin pisar la variable de entorno global.
 */
export async function migrar(
  url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
): Promise<string[]> {
  asegurarDirectorioLocal(url);

  // **Estas dos líneas existen para que el silencio se pueda leer.** El
  // `startCommand` de Render son dos pasos —`migrate && server`— y hasta hoy
  // ninguno anunciaba que había empezado: un arranque colgado adentro de la
  // migración y uno colgado adentro del servidor producían exactamente el mismo
  // log vacío, y el free tier no da shell para ir a mirar.
  console.log("[migrate] conectando a la base");

  // SPEC-208 (B-12): con `exactOptionalPropertyTypes`, `authToken: undefined`
  // explícito ya no es lo mismo que omitirlo — el spread condicional es la
  // diferencia entre las dos.
  const client = createClient({
    url,
    ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {})
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

// Solo corre como script. Sin este guardia, importarlo desde la suite de tests
// dispararía una migración contra la base local como efecto secundario del import.
if (require.main === module) {
  migrar().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
