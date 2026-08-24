import { defineConfig, devices } from '@playwright/test'

import { WEB_PORT } from './ports.ts'

// Suite E2E. Corre en CI como job propio y NO BLOQUEANTE (SPEC-015 §5), y a
// mano con `pnpm e2e` (o `pnpm e2e:ui` para el modo interactivo). No entra en
// `pnpm test`: levanta dos servidores y una base, que es otra clase de costo.
//
// Por qué existe: además de verificar los flujos, produce tres cosas que el
// SOM de M3 exige como evidencia de entrega — capturas, video del walkthrough
// completo, y los test IDs de M2-D5 §4-6 ejecutándose de verdad.
//
// Los artefactos van a e2e/.artifacts/ y están gitignoreados: son salida, no
// fuente. El repo ya carga 21 MB de capturas oficiales en docs/.

// Puerto propio del árbol (D-031): 3000 en el principal, otro en cada worktree.
const BASE_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts/test-results',
  fullyParallel: false, // comparten la misma DB sembrada
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: './e2e/.artifacts/report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    video: 'on', // el walkthrough grabado es evidencia de M3 (criterio 13)
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      // Mobile-first es la superficie primaria (M2-D3 §Principio 4): todo flujo
      // tiene que funcionar en una columna de ~380px.
      // El perfil iPhone 13 (390×844, touch) da el viewport de referencia del
      // diseño, pero se renderiza con Chromium: su `defaultBrowserType` es
      // webkit, y bajar un segundo navegador de ~100 MB no aporta nada acá.
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' }
    },
    {
      // En desktop el BottomNav se reemplaza por sidebar y el contenido pasa a
      // grillas multi-columna (M2-D1 §Responsive behavior).
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    }
  ],
  webServer: {
    // Levanta web + api en los puertos de ESTE árbol. Si ya corren, los reusa.
    command: 'pnpm dev',
    cwd: '../..',
    url: BASE_URL,
    env: {
      // **El limiter de login tiene que subir para el e2e.** Con el default de
      // desarrollo (20) la suite se queda sin presupuesto: cada proyecto hace
      // ~10 logins y son dos proyectos, así que `mobile` consumía la cuota y
      // `desktop` recibía 429 en los cuatro paneles. Se veía como "el login no
      // funciona en desktop" y era el limiter haciendo su trabajo.
      //
      // El comportamiento del limiter se prueba aparte, con su propio máximo
      // (apps/api/test/rate-limit.test.ts) — mismo criterio que
      // apps/api/vitest.config.mts.
      LOGIN_RATE_LIMIT_MAX: '100000'
    },
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe'
  }
})
