import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export const LOCAL_DB_DIR = ".data";
export const DEFAULT_DATABASE_URL = `file:./${LOCAL_DB_DIR}/dev.db`;

export const urlDeLaBase = (env: NodeJS.ProcessEnv = process.env): string =>
  env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

export function asegurarDirectorioLocal(url: string): void {
  if (!url.startsWith("file:")) return;

  const relativo = url.slice("file:".length);
  const dir = path.dirname(path.resolve(process.cwd(), relativo));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
