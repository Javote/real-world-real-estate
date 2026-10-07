import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // happy-dom por defecto; jsdom en el archivo que lo pide con `@vitest-environment jsdom`.
    environment: 'happy-dom',
    setupFiles: ['./src/test/a11y.ts', './src/test/testing-library-setup.ts'],
    testTimeout: 15000,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/routeTree.gen.ts', 'src/main.tsx', 'src/routes/-test-mount.tsx'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
})
