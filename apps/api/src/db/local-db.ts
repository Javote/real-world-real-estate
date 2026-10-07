import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { entorno } from "../platform/config.js";

export { DEFAULT_DATABASE_URL, LOCAL_DB_DIR } from "../platform/config.js";

export const urlDeLaBase = (env: NodeJS.ProcessEnv = process.env): string =>
  entorno(env).DATABASE_URL;

export function asegurarDirectorioLocal(url: string): void {
  if (!url.startsWith("file:")) return;

  const relativo = url.slice("file:".length);
  const dir = path.dirname(path.resolve(process.cwd(), relativo));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
