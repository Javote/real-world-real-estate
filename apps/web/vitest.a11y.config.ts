import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

export default mergeConfig(
  base,
  defineConfig({
    test: {
      setupFiles: ['./a11y/vitest-setup.ts'],
      exclude: ['src/test/a11y.smoke.test.tsx']
    }
  })
)
