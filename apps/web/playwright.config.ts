import { defineConfig, devices } from '@playwright/test'

import { WEB_PORT } from './ports.ts'

const BASE_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts/test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: './e2e/.artifacts/report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    video: 'on',
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
