import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Coverage — SPEC-017.
    //
    // **Vitest, por default, solo cuenta los archivos que algún test importa.**
    // Sin `include`, un módulo que ningún test toca no entra al denominador y
    // el número sale inflado (100% de 142 líneas cuando el código real tiene
    // 232). `include: ["src/**"]` mide contra TODO el código fuente, como ya
    // hace `apps/api`.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95
      }
    }
  }
});
