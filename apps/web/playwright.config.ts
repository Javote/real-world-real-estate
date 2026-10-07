import { defineConfig, devices } from '@playwright/test'

import { API_ORIGIN, WEB_PORT } from './ports.ts'

const BASE_URL = `http://localhost:${WEB_PORT}`

// La suite no compila nada mientras corre: lo que se publica, ya compilado (`pnpm build` antes).
// Las variables de la base y del JWT las pone quien corre la suite, igual que con `pnpm dev`.
const SOBRE_EL_BUILD = process.env.E2E_BUILD === '1'
const ENTORNO = { LOGIN_RATE_LIMIT_MAX: '100000' }

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts/test-results',
  // Test por test, así los shards de CI se reparten parejo. En CI, un worker por runner (lo que
  // recomienda Playwright: un test inestable frena el deploy); en local, 4: con 6 la CPU se satura
  // y a11y vence por timeout (medido el 2026-10-07).
  fullyParallel: true,
  workers: process.env.CI ? 1 : 4,
  reporter: [['list'], ['html', { outputFolder: './e2e/.artifacts/report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    // El video de todo es evidencia, no diagnóstico: solo con `E2E_VIDEO=on` (`e2e:evidencia`).
    video: process.env.E2E_VIDEO === 'on' ? 'on' : 'retain-on-failure',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' }
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    }
  ],
  webServer: SOBRE_EL_BUILD
    ? [
        {
          // El `start` de la API, desde su carpeta: la base de `DATABASE_URL` es relativa a ella.
          command: 'node --import ./dist/src/instrumentation.js dist/src/server.js',
          cwd: '../api',
          url: `${API_ORIGIN}/health`,
          env: { ...ENTORNO, PORT: new URL(API_ORIGIN).port },
          stdout: 'ignore',
          stderr: 'pipe'
        },
        {
          // `preview` usa el proxy de `server.proxy`: `/api` va a la API como en dev.
          command: `pnpm exec vite preview --port ${WEB_PORT} --strictPort`,
          url: BASE_URL,
          stdout: 'ignore',
          stderr: 'pipe'
        }
      ]
    : {
        command: 'pnpm dev',
        cwd: '../..',
        url: BASE_URL,
        env: ENTORNO,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe'
      }
})
