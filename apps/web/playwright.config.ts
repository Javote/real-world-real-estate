import { defineConfig, devices } from '@playwright/test'

import { WEB_PORT } from './ports.ts'

const BASE_URL = `http://localhost:${WEB_PORT}`

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
  webServer: {
    command: 'pnpm dev',
    cwd: '../..',
    url: BASE_URL,
    env: {
      LOGIN_RATE_LIMIT_MAX: '100000'
    },
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe'
  }
})
