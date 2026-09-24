// Config propia de vitest: NO reutiliza vite.config.ts porque los plugins de
// nitro/TanStack Start no aplican (ni funcionan) en el entorno de tests jsdom.

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    // `globals: true` no es por comodidad: Testing Library engancha su
    // `cleanup` automático solo si detecta un `afterEach` global. Sin eso el
    // DOM sobrevive entre tests del mismo archivo y el segundo `render()`
    // encuentra los dos árboles — se ve como un componente que duplica nodos.
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/a11y.ts', './src/test/testing-library-setup.ts'],
    // Bajo carga (la suite de la API corriendo a la vez) el render tarda más
    // que los 5s por defecto — SPEC-019 §Paso 0, punto 5, reproducido el
    // 2026-09-22: tres de tres corridas rojas con esa carga, cero sin ella.
    testTimeout: 15000,
    // e2e/ es de Playwright, no de vitest: sin esto vitest levanta los .spec.ts
    // de ahí (su `include` por defecto matchea test Y spec) y explota.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],

    // Coverage — SPEC-017.
    //
    // **Sin `include`, vitest solo cuenta los archivos que algún test
    // importa** — medido: 84,8% de 601 líneas (falso) contra 29,1% de 1.755
    // (honesto, con `include`). `**/*.{ts,tsx}` y no `**` a secas: `src/**`
    // pelado intenta parsear `styles.css` como JS al generar el reporte de
    // archivos sin cubrir, y revienta.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Lo genera TanStack Router (`tsr generate`); no es código propio.
        'src/routeTree.gen.ts',
        // Bootstrap del proceso — el mismo criterio que `src/server.ts` en
        // `apps/api/vitest.config.mts` (SPEC-019 §Paso 0, punto 7, decisión
        // del dueño 2026-09-22): monta la app sobre `#root` y no decide nada.
        // Su único `if` (`#root` ausente) no se alcanza, y extraerlo para
        // testear un `createRoot().render()` no probaría ningún comportamiento.
        'src/main.tsx',
        // Soporte de test que vive en `src/` por la convención del prefijo
        // `-` de TanStack Router (SPEC-019 §Paso 0, punto 4) — no es código
        // de la app.
        'src/routes/-test-mount.tsx'
      ],
      // Las cuatro métricas llegaron al 100% (SPEC-019, cierre 2026-09-24, lotes
      // W1–W9). Trinquete, mismo criterio que `packages/shared`: al 100% no hay
      // margen que dejar — cualquier baja futura tiene que ponerse roja.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
})
