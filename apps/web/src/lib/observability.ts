import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

// M3 §4/§5 — errores + web vitals del lado del cliente. Las dos quedan
// apagadas sin su env var: un checkout nuevo, sin haber creado ninguna
// cuenta, arranca `pnpm dev` igual (mismo criterio que
// `apps/api/src/instrumentation.ts`).
//
// **PostHog acá es deliberadamente angosto.** El pedido fue "UX, web vitals",
// no analítica de producto — y la regla 2 (cero PII) pide cuidado extra con
// una herramienta de terceros: sin autocapture de clicks (el texto de un
// botón puede traer un email o un nombre) y sin session recording (graba
// pantalla, así que graba todo lo que haya en ella). Lo que queda prendido es
// `capture_performance` (Core Web Vitals: LCP/INP/CLS) y el pageview
// default — ninguno de los dos toca contenido de la página.
export function initObservability(): void {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      // Regla 2: nada de IP/headers por default.
      sendDefaultPii: false
    })
  }

  const posthogKey = import.meta.env.VITE_POSTHOG_KEY
  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      autocapture: false,
      disable_session_recording: true,
      capture_performance: true
    })
  }
}
