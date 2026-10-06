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
export function programarObservabilidad(): void {
  const iniciar = () => void initObservability()
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(iniciar, { timeout: 2000 })
  } else {
    requestAnimationFrame(() => setTimeout(iniciar))
  }
}
