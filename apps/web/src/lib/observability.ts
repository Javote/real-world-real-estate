export async function initObservability(): Promise<void> {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY

  await Promise.all([
    sentryDsn
      ? import('@sentry/react').then((Sentry) => {
          Sentry.init({
            dsn: sentryDsn,
            environment: import.meta.env.MODE,
            sendDefaultPii: false
          })
        })
      : undefined,
    posthogKey
      ? import('posthog-js').then(({ default: posthog }) => {
          posthog.init(posthogKey, {
            api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
            person_profiles: 'identified_only',
            autocapture: false,
            disable_session_recording: true,
            capture_performance: true
          })
        })
      : undefined
  ])
}

// Después del primer pintado: bajarlas junto con el render compite por la CPU y empuja el LCP.
// Ni montar ni el primer render del router alcanzan: el navegador queda ocioso antes de pintar.
// Una pestaña abierta en segundo plano no pinta nunca: por eso el plazo.
export function programarObservabilidad(): void {
  let programada = false
  const programar = () => {
    if (programada) return
    programada = true
    observador?.disconnect()
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => void initObservability(), { timeout: 2000 })
    } else {
      setTimeout(() => void initObservability())
    }
  }
  const observador =
    typeof PerformanceObserver === 'function'
      ? new PerformanceObserver((lista) => {
          if (lista.getEntriesByName('first-contentful-paint').length > 0) programar()
        })
      : undefined
  observador?.observe({ type: 'paint', buffered: true })
  setTimeout(programar, 5000)
}
