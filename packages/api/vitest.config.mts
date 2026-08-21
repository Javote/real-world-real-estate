import path from "node:path";
import { defineConfig } from "vitest/config";

// La suite corre contra una base SQLite PROPIA (prisma/test.db), no contra
// dev.db: un test no puede depender del seed de desarrollo ni ensuciarlo.
// La crea y la siembra test/global-setup.ts en cada corrida.
export default defineConfig({
  // Los tests resuelven @plataforma/shared al FUENTE, no al dist. Dos razones:
  // no hay que compilar antes de testear, y es imposible testear contra un dist
  // viejo. El dist existe solo para el runtime de la API, que es CommonJS y lo
  // carga con require() (ver packages/shared/tsconfig.json).
  resolve: {
    alias: {
      "@plataforma/shared": path.resolve(process.cwd(), "../shared/src/index.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "test-secret-jamas-en-produccion",
      NODE_ENV: "test",
      // Directorio propio: la suite no puede ensuciar packages/api/uploads.
      // Y 1 MB para que el test del límite de tamaño no mueva 10 MB.
      UPLOAD_DIR: "./test-uploads",
      MAX_FILE_SIZE_MB: "1",
      // Alto a propósito: las suites comparten proceso y IP, así que el límite
      // real de /login (20) las haría chocar entre archivos. El comportamiento
      // del limiter se prueba aparte, con su propio max — ver rate-limit.test.ts.
      LOGIN_RATE_LIMIT_MAX: "100000",
    },
    // Comparten una sola base sembrada, y un test la muta a propósito
    // (el de token revocado). Sin esto se pisarían entre archivos.
    fileParallelism: false,
  },
});
