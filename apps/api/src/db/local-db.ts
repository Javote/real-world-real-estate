import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

// Dónde vive la base local, y por qué en `.data/` — SPEC-015 §7.
//
// Antes `dev.db` y `test.db` quedaban sueltas en `apps/api/`, mezcladas con el
// código fuente: ocho líneas de `.gitignore` (cada base más sus `-journal`,
// `-wal` y `-shm`) y dos artefactos de runtime en medio de los `src/`. Ahora
// hay un solo directorio ignorado y un solo lugar donde mirar.
//
// **`file:` es relativo al cwd del proceso** (el migrador propio, D-049), que
// en todos los comandos del repo es `apps/api`.

export const LOCAL_DB_DIR = ".data";
export const DEFAULT_DATABASE_URL = `file:./${LOCAL_DB_DIR}/dev.db`;

/**
 * La base contra la que habla el proceso. **Una sola función para todos**: la
 * conexión (`lib/db.ts`), el migrador y el chequeo de credenciales del seed
 * (`credentials.ts`, D-047). Cuando el chequeo resolvía por su cuenta, leía
 * "sin DATABASE_URL" como base remota mientras la conexión escribía en el
 * SQLite local: `pnpm db:seed` sin `.env` reventaba contra una base local.
 */
export const urlDeLaBase = (env: NodeJS.ProcessEnv = process.env): string =>
  env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

/**
 * Crea el directorio de una URL `file:` si falta.
 *
 * **SQLite no crea directorios**: abrir `file:./.data/dev.db` en un árbol recién
 * clonado falla con `SQLITE_CANTOPEN`, que no dice nada de un directorio que no
 * existe. Se llama antes de abrir el cliente, y con una URL remota (Turso) no
 * hace nada.
 */
export function asegurarDirectorioLocal(url: string): void {
  if (!url.startsWith("file:")) return;

  const relativo = url.slice("file:".length);
  const dir = path.dirname(path.resolve(process.cwd(), relativo));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
