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
