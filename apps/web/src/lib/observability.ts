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
