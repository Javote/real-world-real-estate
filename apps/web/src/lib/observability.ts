import type { PostHog } from 'posthog-js/dist/module.slim'
import type { UserRole } from '#/api/types'
import { getSession } from '#/auth/session'

async function iniciarSentry(): Promise<void> {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN
  if (!sentryDsn) return
  const Sentry = await import('@sentry/react')
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1
  })
}

// PostHog mide qué hace la gente: las visitas anónimas del login y los recorridos del inversor y
// del desarrollador. Escribano, certificador y admin quedan afuera. Se identifica solo con el ID
// opaco y el rol (regla 2). Los web vitals los mide Sentry.
const ROLES_CON_ANALITICA: ReadonlySet<UserRole> = new Set<UserRole>(['buyer', 'developer'])

interface ConNavegacion {
  subscribe: (evento: 'onResolved', escucha: () => void) => () => void
}

async function iniciarPostHog(router: ConNavegacion): Promise<void> {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY
  if (!posthogKey) return
  const { default: posthog } = await import('posthog-js/dist/module.slim')

  let habilitado = false
  posthog.init(posthogKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    capture_performance: false,
    disable_surveys: true,
    advanced_disable_flags: true,
    // Lo que PostHog captura solo (el $pageleave al cerrar la pestaña) también respeta el rol.
    before_send: (evento) => (habilitado ? evento : null)
  })

  // La identidad se lee de PostHog y no se lleva en memoria: la persiste en el navegador y una
  // recarga la conserva.
  const registrarVista = (ph: PostHog) => {
    const usuario = getSession()?.user ?? null
    const identificado = ph.get_property('$user_state') === 'identified'
    const esElMismo = identificado && usuario !== null && ph.get_distinct_id() === usuario.id
    habilitado = !usuario || ROLES_CON_ANALITICA.has(usuario.role)
    if (identificado && !esElMismo) ph.reset()
    if (!habilitado) return
    if (usuario && !esElMismo) ph.identify(usuario.id, { role: usuario.role })
    ph.capture('$pageview')
  }

  registrarVista(posthog)
  router.subscribe('onResolved', () => registrarVista(posthog))
}

export function initObservability(router: ConNavegacion): Promise<unknown> {
  return Promise.all([iniciarSentry(), iniciarPostHog(router)])
}

// Después del primer pintado: bajarlas junto con el render compite por la CPU y empuja el LCP.
// Ni montar ni el primer render del router alcanzan: el navegador queda ocioso antes de pintar.
// Una pestaña abierta en segundo plano no pinta nunca: por eso el plazo.
export function programarObservabilidad(router: ConNavegacion): void {
  let programada = false
  const programar = () => {
    if (programada) return
    programada = true
    observador?.disconnect()
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => void initObservability(router), { timeout: 2000 })
    } else {
      setTimeout(() => void initObservability(router))
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
