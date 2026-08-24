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
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**']
  }
})
