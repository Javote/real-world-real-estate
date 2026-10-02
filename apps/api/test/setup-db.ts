import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, expect } from "vitest";
import { SQLITE_SIDECARS, TEMPLATE_DB, TEST_DB_DIR } from "./global-setup.js";

const nombreDelArchivo = path.basename(
  expect.getState().testPath ?? "desconocido.test.ts",
  ".test.ts"
);

const baseDelArchivo = path.join(TEST_DB_DIR, `${nombreDelArchivo}.db`);
const rutaAbsoluta = path.join(process.cwd(), baseDelArchivo);

copyFileSync(path.join(process.cwd(), TEMPLATE_DB), rutaAbsoluta);

process.env.DATABASE_URL = `file:./${baseDelArchivo}`;

const uploadsDelArchivo = path.join(process.cwd(), "test-uploads", nombreDelArchivo);
mkdirSync(uploadsDelArchivo, { recursive: true });
process.env.UPLOAD_DIR = uploadsDelArchivo;

beforeAll(async () => {
  if (process.env.VITEST_DB_DEBUG) {
    console.log(`[test-db] ${nombreDelArchivo} → ${baseDelArchivo}`);
  }

  const { initAnchorPort } = await import("../src/lib/anchor.js");
  await initAnchorPort();
});

afterAll(() => {
  if (process.env.VITEST_KEEP_DB) return;
  for (const sufijo of SQLITE_SIDECARS) {
    const f = `${rutaAbsoluta}${sufijo}`;
    if (existsSync(f)) rmSync(f);
  }
  if (existsSync(uploadsDelArchivo)) rmSync(uploadsDelArchivo, { recursive: true });
});
