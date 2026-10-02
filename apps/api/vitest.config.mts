import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
    globalSetup: ["./test/global-setup.ts", "./test/global-setup-minio.mts"],
    setupFiles: ["./test/setup-db.ts"],
    env: {
      DATABASE_URL: "file:./.data/test.template.db",
      JWT_SECRET: "test-secret-jamas-en-produccion",
      NODE_ENV: "test",
      UPLOAD_DIR: "./test-uploads",
      LOGIN_RATE_LIMIT_MAX: "100000"
    },
    fileParallelism: true,

    // línea sin cubrir vive en su propio `/* v8 ignore … -- @preserve: <motivo>
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts", "src/db/types.ts"],
      thresholds: {
        statements: 99,
        branches: 99,
        functions: 99,
        lines: 99
      }
    }
  }
});
