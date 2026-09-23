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
      // Las cuatro métricas llegaron al 100% (SPEC-017, cierre 2026-09-23):
      // la única rama que faltaba (`byteLength`, `auth.ts`) era inalcanzable
      // y quedó marcada en su línea. Trinquete: al 100% no hay margen que
      // dejar — cualquier baja futura sí tiene que ponerse rojo.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
