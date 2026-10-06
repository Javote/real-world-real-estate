import { isNotFound, isRedirect } from '@tanstack/react-router'
import type { PostHog } from 'posthog-js/dist/module.slim'
import type { ErrorInfo } from 'react'
import type { RootOptions } from 'react-dom/client'
import type { UserRole } from '#/api/types'
import { getSession } from '#/auth/session'

type Sentry = typeof import('@sentry/react')

// Sentry baja después del primer pintado: lo que falle antes espera acá, con un tope.
interface ErrorPendiente {
  error: unknown
  manejado: boolean
  componentStack?: string
}
const MAX_PENDIENTES = 20
const pendientes: ErrorPendiente[] = []
let sentry: Sentry | undefined

function enviar(s: Sentry, { error, manejado, componentStack }: ErrorPendiente): void {
  if (componentStack === undefined) {
    s.captureException(error, { mechanism: { handled: manejado, type: 'auto.browser.temprano' } })
    return
  }
  s.captureReactException(
    error,
    { componentStack },
    { mechanism: { handled: manejado, type: 'auto.function.react.error_handler' } }
  )
}

function anotarError(pendiente: ErrorPendiente): void {
  if (sentry) enviar(sentry, pendiente)
  else if (import.meta.env.VITE_SENTRY_DSN && pendientes.length < MAX_PENDIENTES)
    pendientes.push(pendiente)
}

const alFallar = (evento: ErrorEvent) =>
  anotarError({ error: evento.error ?? evento.message, manejado: false })
const alRechazar = (evento: PromiseRejectionEvent) =>
  anotarError({ error: evento.reason, manejado: false })

// Hasta que Sentry instala sus propios handlers globales.
function escucharErroresTempranos(): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  window.addEventListener('error', alFallar)
  window.addEventListener('unhandledrejection', alRechazar)
}

// La pantalla de error de una ruta es un error boundary de React: el router atrapa el error y sin
// esto Sentry no se entera. Redirect y not-found son control de flujo, no fallas.
function errorDeReact(manejado: boolean) {
  return (error: unknown, info: ErrorInfo) => {
    if (isRedirect(error) || isNotFound(error)) return
    console.error(error)
    anotarError({ error, manejado, componentStack: info.componentStack ?? '' })
  }
}

export const erroresDeReact = {
  onCaughtError: errorDeReact(true),
  onUncaughtError: errorDeReact(false)
} satisfies RootOptions

interface ConNavegacion {
  subscribe: (evento: 'onResolved', escucha: () => void) => () => void
}

async function iniciarSentry(router: ConNavegacion): Promise<Sentry | undefined> {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN
  if (!sentryDsn) return undefined
  const s = await import('@sentry/react')
  const apiOrigin = import.meta.env.VITE_API_ORIGIN
  s.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    // Nombra cargas y navegaciones por la ruta (`/project/$projectId`), no por la URL con el ID.
    integrations: [s.tanstackRouterBrowserTracingIntegration(router)],
    tracesSampleRate: 1,
    // La API continúa la traza con OTel (traceparent), así un clic se sigue hasta la base en Tempo.
    // Su CORS acepta los tres headers; sin `VITE_API_ORIGIN` la API es del mismo origen.
    propagateTraceparent: true,
    ...(apiOrigin ? { tracePropagationTargets: [apiOrigin] } : {})
  })
  identificarEnSentry(s)
  sentry = s
  window.removeEventListener('error', alFallar)
  window.removeEventListener('unhandledrejection', alRechazar)
  for (const pendiente of pendientes.splice(0)) enviar(s, pendiente)
  return s
}

// Sentry ve a todos los roles: un error de un escribano importa igual. Solo el ID opaco y el rol.
function identificarEnSentry(s: Sentry): void {
  const usuario = getSession()?.user ?? null
  s.setUser(usuario ? { id: usuario.id } : null)
  s.setTag('role', usuario?.role ?? 'anonymous')
}

// PostHog mide qué hace la gente: las visitas anónimas del login y los recorridos del inversor y
// del desarrollador. Escribano, certificador y admin quedan afuera. Se identifica solo con el ID
// opaco y el rol (regla 2). Los web vitals los mide Sentry.
const ROLES_CON_ANALITICA: ReadonlySet<UserRole> = new Set<UserRole>(['buyer', 'developer'])

async function iniciarPostHog(): Promise<(() => void) | undefined> {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY
  if (!posthogKey) return undefined
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

  return () => registrarVista(posthog)
}

// Las dos leen la sesión en el mismo enganche al router.
export async function initObservability(router: ConNavegacion): Promise<void> {
  const [s, registrarVista] = await Promise.all([iniciarSentry(router), iniciarPostHog()])
  registrarVista?.()
  router.subscribe('onResolved', () => {
    if (s) identificarEnSentry(s)
    registrarVista?.()
  })
}

// Después del primer pintado: bajarlas junto con el render compite por la CPU y empuja el LCP.
// Ni montar ni el primer render del router alcanzan: el navegador queda ocioso antes de pintar.
// Una pestaña abierta en segundo plano no pinta nunca: por eso el plazo.
export function programarObservabilidad(router: ConNavegacion): void {
  escucharErroresTempranos()
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
