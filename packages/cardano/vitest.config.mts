import path from "node:path";
import { defineConfig } from "vitest/config";

// Igual que en apps/api: los tests resuelven @plataforma/shared al FUENTE, no
// al dist, y la ruta se ancla a ESTE archivo y no al cwd (D-055).
export default defineConfig({
  test: {
    // Levanta y baja el devnet SOLO cuando `YACI_TEST=1`. En `pnpm test` no
    // hace nada: el archivo se importa y sale.
    globalSetup: ["./vitest.devnet.mts"],

    // Coverage — SPEC-017. `include: ["src/**"]` mide contra todo el código
    // fuente, como ya hace `apps/api` — sin esto, un módulo que ningún test
    // importa no entra al denominador y el número sale inflado.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**"],
      exclude: [
        // Solo se corre con YACI_TEST=1, contra un nodo real: nunca en la
        // corrida normal que mide esta cobertura.
        "src/yaci.test.ts",
        "src/vitest.devnet.mts"
      ],
      thresholds: {
        statements: 95,
        branches: 94,
        functions: 95,
        lines: 95
      }
    }
  },
  resolve: {
    alias: {
      "@plataforma/shared": path.resolve(import.meta.dirname, "../shared/src/index.ts")
    }
  }
});
