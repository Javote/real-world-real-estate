import path from "node:path";
import { defineConfig } from "vitest/config";

// La suite corre contra bases SQLite PROPIAS, no contra dev.db: un test no
// puede depender del seed de desarrollo ni ensuciarlo.
//
// **Una base por ARCHIVO de test** (SPEC-015 §1): `global-setup.ts` siembra una
// plantilla una sola vez y `setup-db.ts` la copia antes de cada archivo. Así
// ningún archivo ve el estado que dejó otro, y por eso vuelve a poder correr en
// paralelo.
export default defineConfig({
  // Los tests resuelven @plataforma/shared al FUENTE, no al dist. Dos razones:
  // no hay que compilar antes de testear, y es imposible testear contra un dist
  // viejo. El dist existe solo para el runtime de la API, que es CommonJS y lo
  // carga con require() (ver packages/shared/tsconfig.json).
  //
  // La ruta se ancla a ESTE archivo, no al `process.cwd()`. Con el cwd, mover el
  // package rompía la resolución en silencio: al pasar de `packages/api` a
  // `apps/api` (D-055), `../shared` dejó de existir y las 9 suites fallaron con
  // "Cannot find package". Un path relativo al cwd es una dependencia oculta de
  // desde dónde se invoca el comando.
  resolve: {
    alias: {
      "@plataforma/shared": path.resolve(import.meta.dirname, "../../packages/shared/src/index.ts"),
      "@plataforma/cardano": path.resolve(
        import.meta.dirname,
        "../../packages/cardano/src/index.ts"
      )
    }
  },
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    // Corre una vez POR ARCHIVO y antes de sus imports, que es lo que hace
    // falta: `src/lib/db.ts` lee DATABASE_URL al importarse.
    setupFiles: ["./test/setup-db.ts"],
    env: {
      // Piso: `setup-db.ts` lo pisa con la base propia de cada archivo. Queda
      // apuntando a la plantilla para que nada corra sin base si ese setup no
      // llegara a ejecutarse.
      DATABASE_URL: "file:./.data/test.template.db",
      JWT_SECRET: "test-secret-jamas-en-produccion",
      NODE_ENV: "test",
      // Piso: `setup-db.ts` lo pisa con un subdirectorio propio por archivo,
      // porque hay tests que cuentan archivos en disco para detectar huérfanos.
      // Y 1 MB para que el test del límite de tamaño no mueva 10 MB.
      UPLOAD_DIR: "./test-uploads",
      MAX_FILE_SIZE_MB: "1",
      // Alto a propósito: las suites comparten proceso y IP, así que el límite
      // real de /login (20) las haría chocar entre archivos. El comportamiento
      // del limiter se prueba aparte, con su propio max — ver rate-limit.test.ts.
      LOGIN_RATE_LIMIT_MAX: "100000"
    },
    // **En paralelo otra vez.** Estuvo en `false` mientras los archivos
    // compartían una sola base sembrada y se pisaban entre sí; con una base por
    // archivo (SPEC-015 §1) esa razón desapareció.
    fileParallelism: true
  }
});
