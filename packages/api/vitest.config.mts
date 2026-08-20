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
    },
    // Comparten una sola base sembrada, y un test la muta a propósito
    // (el de token revocado). Sin esto se pisarían entre archivos.
    fileParallelism: false,
  },
});
