import path from "node:path";
import { defineConfig } from "vitest/config";

// Igual que en apps/api: los tests resuelven @plataforma/shared al FUENTE, no
// al dist, y la ruta se ancla a ESTE archivo y no al cwd (D-055).
export default defineConfig({
  resolve: {
    alias: {
      "@plataforma/shared": path.resolve(import.meta.dirname, "../shared/src/index.ts")
    }
  }
});
