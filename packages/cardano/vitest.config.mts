import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./vitest.devnet.mts"],

    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**"],
      exclude: ["src/yaci.test.ts", "src/vitest.devnet.mts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  },
  resolve: {
    alias: {
      "@plataforma/shared": path.resolve(import.meta.dirname, "../shared/src/index.ts")
    }
  }
});
