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
    // El segundo solo actúa con `S3_TEST=1`: levanta MinIO y lo baja al
    // terminar. En `pnpm test` entra, ve la variable vacía y sale.
    globalSetup: ["./test/global-setup.ts", "./test/global-setup-minio.mts"],
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
      UPLOAD_DIR: "./test-uploads",
      // Alto a propósito: las suites comparten proceso y IP, así que el límite
      // real de /login (20) las haría chocar entre archivos. El comportamiento
      // del limiter se prueba aparte, con su propio max — ver rate-limit.test.ts.
      LOGIN_RATE_LIMIT_MAX: "100000"
    },
    // **En paralelo otra vez.** Estuvo en `false` mientras los archivos
    // compartían una sola base sembrada y se pisaban entre sí; con una base por
    // archivo (SPEC-015 §1) esa razón desapareció.
    fileParallelism: true,

    // Coverage — SPEC-015 §3, SPEC-017 §paso 4, cerrada en SPEC-018.
    //
    // **Es un trinquete: los umbrales suben con cada cierre, nunca bajan.**
    // El 95% de M3 se mide contra los **test IDs** del backlog, no contra
    // líneas (M2-D5 §8) — eso lo cuenta `scripts/check-testids.mjs`. Esto de
    // acá es la otra mitad: que el código que existe esté ejercitado, con la
    // vara más estricta que pidió el dueño (branches ≥95%, el resto ≥98%).
    //
    // **SPEC-018 cerró el 2026-09-23** con las cuatro métricas al 100%
    // (2070/2070 statements, 839/839 branches, 424/424 functions, 1900/1900
    // lines) — de dónde salió cada rama y cada marca de "inalcanzable" está
    // en `specs/SPEC-018-cobertura-de-apps-api.md`, no acá: el motivo de cada
    // línea sin cubrir vive en su propio `/* v8 ignore … -- @preserve: <motivo>
    // (SPEC-018) */`, no en este comentario. Los umbrales quedan un punto por
    // debajo de lo medido (mismo criterio que `packages/shared`/`cardano`):
    // margen para que un archivo nuevo con una rama chica sin marcar no
    // vuelva rojo el CI por una fracción de punto, sin dejar de exigir
    // prácticamente el 100%.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        // Bootstrap del proceso: no tiene lógica que testear, y arrancarlo en
        // un test levantaría un puerto. Mismo criterio que `src/main.tsx` en
        // `apps/web/vitest.config.ts` (SPEC-019 §Paso 0, punto 7, decisión del
        // dueño 2026-09-22) — SPEC-017 decía que este archivo "volvía a
        // contar" y nunca se hizo; queda excluido a propósito.
        "src/server.ts",
        // Solo tipos: no emite runtime, así que contarlo distorsiona.
        "src/db/types.ts"
      ],
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99
      }
    }
  }
});
