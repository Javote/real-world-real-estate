import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

// `pnpm --filter web test:a11y` — la suite entera con axe después de cada test
// (SPEC-112 §2, `a11y/vitest-setup.ts`). Sin coverage: la vara de cobertura es
// la de `vitest.config.ts`, y esta corrida mide otra cosa.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      setupFiles: ['./a11y/vitest-setup.ts'],
      // El smoke test del matcher renderiza un <img> sin alt A PROPÓSITO: es el
      // caso de control de `src/test/a11y.ts`, no un defecto de la app.
      exclude: ['src/test/a11y.smoke.test.tsx']
    }
  })
)
