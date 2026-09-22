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
        'src/routeTree.gen.ts'
      ],
      thresholds: {
        statements: 36,
        branches: 29,
        functions: 37,
        lines: 37
      }
    }
  }
})
