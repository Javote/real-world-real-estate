import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      // El JSON del contrato minificado es un dato generado, no código: lo compara `contract.test.ts`.
      include: ["src/**/*.ts"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
