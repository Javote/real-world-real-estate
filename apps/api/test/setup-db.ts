import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, expect } from "vitest";
import { SQLITE_SIDECARS, TEMPLATE_DB, TEST_DB_DIR } from "./global-setup";

// Una base **y un directorio de uploads** propios para CADA archivo de test
// (SPEC-015 §1, invariantes 1 y 2).
//
// Corre como `setupFiles`, o sea **una vez por archivo y antes de sus
// imports**. Eso es lo que hace que funcione: `src/lib/db.ts` lee
// `process.env.DATABASE_URL` al importarse, así que la variable tiene que estar
// puesta antes de que el archivo de test importe `../src/app`. En un
// `beforeAll` del propio test ya sería tarde.
//
// **Copiar la plantilla en vez de migrar y sembrar por archivo**: migrar +
// bcrypt de nueve usuarios por archivo son ~2s × 21 archivos. La copia de un
// archivo de 300 KB es instantánea y da exactamente la misma base.
//
// El directorio de uploads va por archivo por la MISMA razón que la base, y no
// es teórica: `evidence-upload.test.ts` afirma que un rechazo no deja archivo
// huérfano contando los archivos del directorio. Con uno compartido, esa cuenta
// incluye lo que están subiendo los demás archivos en paralelo.

const nombreDelArchivo = path.basename(
  expect.getState().testPath ?? "desconocido.test.ts",
  ".test.ts"
);

const baseDelArchivo = path.join(TEST_DB_DIR, `${nombreDelArchivo}.db`);
const rutaAbsoluta = path.join(process.cwd(), baseDelArchivo);

copyFileSync(path.join(process.cwd(), TEMPLATE_DB), rutaAbsoluta);

// Se pisa el valor de `vitest.config.mts`, que apunta a la plantilla para que
// nada quede sin base si este setup no llegara a correr.
process.env.DATABASE_URL = `file:./${baseDelArchivo}`;

const uploadsDelArchivo = path.join(process.cwd(), "test-uploads", nombreDelArchivo);
mkdirSync(uploadsDelArchivo, { recursive: true });
process.env.UPLOAD_DIR = uploadsDelArchivo;

beforeAll(() => {
  // Deja rastro de qué base usó cada archivo: sin esto, depurar un test que
  // falla solo dentro de la suite es adivinar.
  if (process.env.VITEST_DB_DEBUG) {
    console.log(`[test-db] ${nombreDelArchivo} → ${baseDelArchivo}`);
  }
});

afterAll(() => {
  // Se borran al terminar salvo que se pidan para inspeccionarlos.
  if (process.env.VITEST_KEEP_DB) return;
  for (const sufijo of SQLITE_SIDECARS) {
    const f = `${rutaAbsoluta}${sufijo}`;
    if (existsSync(f)) rmSync(f);
  }
  if (existsSync(uploadsDelArchivo)) rmSync(uploadsDelArchivo, { recursive: true });
});
