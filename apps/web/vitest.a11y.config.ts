import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // axe lee estilos computados, y happy-dom devuelve `display` vacío: la capa mide en jsdom.
      environment: 'jsdom',
      setupFiles: ['./a11y/vitest-setup.ts'],
      exclude: ['src/test/a11y.smoke.test.tsx']
    }
  })
)
