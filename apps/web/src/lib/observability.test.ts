import { notFound, redirect } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '#/api/types'
import { clearSession, setSession } from '#/auth/session'

const mocks = vi.hoisted(() => ({
  sentryInit: vi.fn(),
  browserTracing: { name: 'BrowserTracing' },
  tanstackTracing: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  captureException: vi.fn(),
  captureReactException: vi.fn(),
  posthogInit: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  estado: { distinctId: 'anon-1', identificado: false },
  cargados: [] as string[]
}))

vi.mock('@sentry/react', () => {
  mocks.cargados.push('@sentry/react')
  return {
    init: mocks.sentryInit,
    tanstackRouterBrowserTracingIntegration: (router: unknown) => {
      mocks.tanstackTracing(router)
      return mocks.browserTracing
    },
    setUser: mocks.setUser,
    setTag: mocks.setTag,
    captureException: mocks.captureException,
    captureReactException: mocks.captureReactException
  }
})
vi.mock('posthog-js/dist/module.slim', () => {
  mocks.cargados.push('posthog-js/dist/module.slim')
  return {
    default: {
      init: mocks.posthogInit,
      capture: mocks.capture,
      identify: (id: string, props: unknown) => {
        mocks.identify(id, props)
        mocks.estado.distinctId = id
        mocks.estado.identificado = true
      },
      reset: () => {
        mocks.reset()
        mocks.estado.distinctId = 'anon-2'
        mocks.estado.identificado = false
      },
      get_distinct_id: () => mocks.estado.distinctId,
      get_property: (p: string) =>
        p === '$user_state' ? (mocks.estado.identificado ? 'identified' : 'anonymous') : undefined
    }
  }
})

function routerFalso() {
  let alResolver: (() => void) | undefined
  return {
    subscribe: vi.fn((_evento: 'onResolved', escucha: () => void) => {
      alResolver = escucha
      return () => {}
    }),
    navegar: () => alResolver?.()
  }
}

async function initObservability(router = routerFalso()) {
  const modulo = await import('./observability')
  await modulo.initObservability(router)
  return router
}

function entrarComo(id: string, role: SessionUser['role']) {
  setSession({
    token: 't',
    user: { id, role, email: `${id}@example.com`, fullName: 'Nombre Real' }
  })
}

describe('initObservability', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.cargados.length = 0
    clearSession()
    vi.stubEnv('VITE_SENTRY_DSN', '')
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    vi.stubEnv('VITE_API_ORIGIN', '')
    vi.stubEnv('VITE_POSTHOG_HOST', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    clearSession()
  })

  it('sin DSN ni key no descarga ni inicializa ninguna de las dos herramientas', async () => {
    await initObservability()

    expect(mocks.cargados).toEqual([])
    expect(mocks.sentryInit).not.toHaveBeenCalled()
    expect(mocks.posthogInit).not.toHaveBeenCalled()
  })

  it('con DSN inicializa Sentry sin PII, con las trazas del router que miden los web vitals por ruta, y PostHog no se descarga', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@sentry.example/1')

    const router = await initObservability()

    expect(mocks.tanstackTracing).toHaveBeenCalledWith(router)
    expect(mocks.sentryInit).toHaveBeenCalledWith({
      dsn: 'https://k@sentry.example/1',
      environment: 'test',
      sendDefaultPii: false,
      integrations: [mocks.browserTracing],
      tracesSampleRate: 1,
      propagateTraceparent: true
    })
    expect(mocks.cargados).toEqual(['@sentry/react'])
    expect(mocks.posthogInit).not.toHaveBeenCalled()
  })

  it('con la API en otro origen, los headers de traza van solo a ella', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@sentry.example/1')
    vi.stubEnv('VITE_API_ORIGIN', 'https://api.example.com')

    await initObservability()

    expect(mocks.sentryInit).toHaveBeenCalledWith(
      expect.objectContaining({
        propagateTraceparent: true,
        tracePropagationTargets: ['https://api.example.com']
      })
    )
  })

  it('con key y sin host inicializa el núcleo slim de PostHog en el host por defecto, sin capturas automáticas salvo el $pageleave, y Sentry no se descarga', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_abc')
    vi.stubEnv('VITE_POSTHOG_HOST', undefined as unknown as string)

    await initObservability()

    expect(mocks.posthogInit).toHaveBeenCalledWith('phc_abc', {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: true,
      capture_performance: false,
      disable_surveys: true,
      advanced_disable_flags: true,
      before_send: expect.any(Function)
    })
    expect(mocks.cargados).toEqual(['posthog-js/dist/module.slim'])
    expect(mocks.sentryInit).not.toHaveBeenCalled()
  })

  it('con key y host propio usa ese host', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_abc')
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://ph.example.com')

    await initObservability()

    expect(mocks.posthogInit).toHaveBeenCalledWith(
      'phc_abc',
      expect.objectContaining({ api_host: 'https://ph.example.com' })
    )
  })
})

describe('PostHog según el rol de la sesión', () => {
  const evento = { event: '$pageleave', properties: {} } as never
  const beforeSend = () => {
    const config = mocks.posthogInit.mock.calls[0]?.[1] as
      | { before_send: (e: unknown) => unknown }
      | undefined
    if (!config) throw new Error('PostHog no se inicializó')
    return config.before_send
  }
  const guardadoEnElNavegador = (id: string) => {
    mocks.estado.distinctId = id
    mocks.estado.identificado = true
  }

  beforeEach(() => {
    vi.resetModules()
    clearSession()
    mocks.estado.distinctId = 'anon-1'
    mocks.estado.identificado = false
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_abc')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    clearSession()
  })

  it('sin sesión (login): página vista anónima, sin identify', async () => {
    const router = await initObservability()

    expect(router.subscribe).toHaveBeenCalledWith('onResolved', expect.any(Function))
    expect(mocks.capture).toHaveBeenCalledWith('$pageview')
    expect(mocks.identify).not.toHaveBeenCalled()
    expect(beforeSend()(evento)).toBe(evento)
  })

  it('inversor: se identifica una sola vez con el ID opaco y el rol, nunca con email ni nombre, y cada navegación es una página vista', async () => {
    entrarComo('u-inv', 'buyer')
    const router = await initObservability()
    router.navegar()

    expect(mocks.identify).toHaveBeenCalledOnce()
    expect(mocks.identify).toHaveBeenCalledWith('u-inv', { role: 'buyer' })
    expect(mocks.capture).toHaveBeenCalledTimes(2)
    expect(mocks.capture).toHaveBeenCalledWith('$pageview')
  })

  it('desarrollador: también se mide', async () => {
    entrarComo('u-dev', 'developer')
    await initObservability()

    expect(mocks.identify).toHaveBeenCalledWith('u-dev', { role: 'developer' })
    expect(mocks.capture).toHaveBeenCalledWith('$pageview')
  })

  it.each(['notary', 'verifier', 'admin'] as const)(
    '%s: no manda nada, ni lo que PostHog captura solo',
    async (rol) => {
      entrarComo('u-otro', rol)
      await initObservability()

      expect(mocks.capture).not.toHaveBeenCalled()
      expect(mocks.identify).not.toHaveBeenCalled()
      expect(mocks.reset).not.toHaveBeenCalled()
      expect(beforeSend()(evento)).toBeNull()
    }
  )

  it('al cerrar sesión se resetea y el login vuelve a ser anónimo', async () => {
    entrarComo('u-inv', 'buyer')
    const router = await initObservability()

    clearSession()
    router.navegar()

    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.identify).toHaveBeenCalledOnce()
    expect(mocks.capture).toHaveBeenCalledTimes(2)
  })

  it('si en la misma pestaña entra un escribano después de un inversor, se resetea y deja de mandar', async () => {
    entrarComo('u-inv', 'buyer')
    const router = await initObservability()

    entrarComo('u-esc', 'notary')
    router.navegar()

    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.capture).toHaveBeenCalledOnce()
    expect(beforeSend()(evento)).toBeNull()
  })

  it('después de recargar, el mismo usuario no se vuelve a identificar', async () => {
    guardadoEnElNavegador('u-inv')
    entrarComo('u-inv', 'buyer')
    await initObservability()

    expect(mocks.reset).not.toHaveBeenCalled()
    expect(mocks.identify).not.toHaveBeenCalled()
    expect(mocks.capture).toHaveBeenCalledWith('$pageview')
  })

  it('después de recargar sin sesión, la identidad que quedó guardada se resetea: el login es anónimo', async () => {
    guardadoEnElNavegador('u-inv')
    await initObservability()

    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.identify).not.toHaveBeenCalled()
    expect(mocks.capture).toHaveBeenCalledWith('$pageview')
  })

  it('después de recargar, si entra otro usuario medido, se resetea antes de identificarlo', async () => {
    guardadoEnElNavegador('u-inv')
    entrarComo('u-dev', 'developer')
    await initObservability()

    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.identify).toHaveBeenCalledWith('u-dev', { role: 'developer' })
  })

  it('después de recargar, si entra un escribano, se resetea la identidad guardada y no manda nada', async () => {
    guardadoEnElNavegador('u-inv')
    entrarComo('u-esc', 'notary')
    await initObservability()

    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.capture).not.toHaveBeenCalled()
  })

  it('si cambia el usuario medido, se resetea antes de identificar al nuevo', async () => {
    entrarComo('u-inv', 'buyer')
    const router = await initObservability()

    entrarComo('u-dev', 'developer')
    router.navegar()

    expect(mocks.reset).toHaveBeenCalledOnce()
    expect(mocks.identify).toHaveBeenLastCalledWith('u-dev', { role: 'developer' })
    expect(mocks.reset.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.identify.mock.invocationCallOrder[1] ?? 0
    )
  })
})

describe('Sentry según la sesión', () => {
  beforeEach(() => {
    vi.resetModules()
    clearSession()
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@sentry.example/1')
    vi.stubEnv('VITE_POSTHOG_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    clearSession()
  })

  it('sin sesión no hay usuario y el rol es anónimo', async () => {
    await initObservability()

    expect(mocks.setUser).toHaveBeenCalledWith(null)
    expect(mocks.setTag).toHaveBeenCalledWith('role', 'anonymous')
  })

  it('con sesión manda solo el ID opaco y el rol, también para los roles que PostHog no mide', async () => {
    entrarComo('u-esc', 'notary')
    await initObservability()

    expect(mocks.setUser).toHaveBeenCalledWith({ id: 'u-esc' })
    expect(mocks.setTag).toHaveBeenCalledWith('role', 'notary')
  })

  it('cada navegación vuelve a leer la sesión: al entrar y al salir', async () => {
    const router = await initObservability()

    entrarComo('u-inv', 'buyer')
    router.navegar()
    expect(mocks.setUser).toHaveBeenLastCalledWith({ id: 'u-inv' })
    expect(mocks.setTag).toHaveBeenLastCalledWith('role', 'buyer')

    clearSession()
    router.navegar()
    expect(mocks.setUser).toHaveBeenLastCalledWith(null)
    expect(mocks.setTag).toHaveBeenLastCalledWith('role', 'anonymous')
  })
})

describe('errores antes y después de que Sentry esté listo', () => {
  const info = { componentStack: '\n    at Pantalla' }
  const mecanismoReact = (handled: boolean) => ({
    mechanism: { handled, type: 'auto.function.react.error_handler' }
  })
  // Sin ningún listener de `error` en la ventana, Vitest trata el evento como una excepción suelta.
  const comoLosHandlersDeSentry = () => {}

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    window.addEventListener('error', comoLosHandlersDeSentry)
    clearSession()
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@sentry.example/1')
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    vi.stubGlobal('PerformanceObserver', undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    window.removeEventListener('error', comoLosHandlersDeSentry)
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  async function cargar() {
    const modulo = await import('./observability')
    modulo.programarObservabilidad(routerFalso())
    return modulo
  }

  function rechazo(reason: unknown) {
    return Object.assign(new Event('unhandledrejection'), { reason })
  }

  it('lo que falla antes espera en la cola y sale apenas Sentry arranca, con el usuario ya puesto', async () => {
    const { erroresDeReact, initObservability } = await cargar()
    const enLaVentana = new Error('ventana')
    const enUnaPromesa = new Error('promesa')
    const enLaRuta = new Error('ruta')

    window.dispatchEvent(new ErrorEvent('error', { error: enLaVentana }))
    window.dispatchEvent(rechazo(enUnaPromesa))
    erroresDeReact.onCaughtError(enLaRuta, info)
    expect(mocks.captureException).not.toHaveBeenCalled()
    expect(mocks.captureReactException).not.toHaveBeenCalled()

    entrarComo('u-inv', 'buyer')
    await initObservability(routerFalso())

    const temprano = { mechanism: { handled: false, type: 'auto.browser.temprano' } }
    expect(mocks.captureException).toHaveBeenCalledWith(enLaVentana, temprano)
    expect(mocks.captureException).toHaveBeenCalledWith(enUnaPromesa, temprano)
    expect(mocks.captureReactException).toHaveBeenCalledWith(enLaRuta, info, mecanismoReact(true))
    expect(mocks.setUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.captureException.mock.invocationCallOrder[0] ?? 0
    )
  })

  it('con Sentry listo, el error de React va directo y la ventana queda para los handlers de Sentry', async () => {
    const { erroresDeReact, initObservability } = await cargar()
    await initObservability(routerFalso())
    const escapado = new Error('escapado')

    erroresDeReact.onUncaughtError(escapado, info)
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('ventana') }))

    expect(mocks.captureReactException).toHaveBeenCalledWith(escapado, info, mecanismoReact(false))
    expect(mocks.captureException).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(escapado)
  })

  it('el redirect y el not-found del router no son errores', async () => {
    const { erroresDeReact, initObservability } = await cargar()
    await initObservability(routerFalso())

    erroresDeReact.onCaughtError(redirect({ to: '/login' }), info)
    erroresDeReact.onCaughtError(notFound(), info)

    expect(mocks.captureReactException).not.toHaveBeenCalled()
  })

  it('un error sin objeto (un script de otro origen) va con su mensaje, y uno de React sin pila de componentes, igual', async () => {
    const { erroresDeReact, initObservability } = await cargar()
    const sinPila = new Error('sin pila')

    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }))
    erroresDeReact.onCaughtError(sinPila, {})
    await initObservability(routerFalso())

    expect(mocks.captureException).toHaveBeenCalledWith('Script error.', expect.anything())
    expect(mocks.captureReactException).toHaveBeenCalledWith(
      sinPila,
      { componentStack: '' },
      mecanismoReact(true)
    )
  })

  it('la cola tiene tope', async () => {
    const { initObservability } = await cargar()

    for (let i = 0; i < 30; i++)
      window.dispatchEvent(new ErrorEvent('error', { error: new Error() }))
    await initObservability(routerFalso())

    expect(mocks.captureException).toHaveBeenCalledTimes(20)
  })

  it('sin DSN no escucha ni guarda nada', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')
    const { erroresDeReact } = await cargar()

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('ventana') }))
    erroresDeReact.onCaughtError(new Error('ruta'), info)
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@sentry.example/1')
    const { initObservability } = await import('./observability')
    await initObservability(routerFalso())

    expect(mocks.captureException).not.toHaveBeenCalled()
    expect(mocks.captureReactException).not.toHaveBeenCalled()
  })
})

class PerformanceObserverFalso {
  static instancias: PerformanceObserverFalso[] = []
  observado: unknown
  desconectado = false
  constructor(
    readonly alObservar: (lista: { getEntriesByName: (n: string) => unknown[] }) => void
  ) {
    PerformanceObserverFalso.instancias.push(this)
  }
  observe(opciones: unknown) {
    this.observado = opciones
  }
  disconnect() {
    this.desconectado = true
  }
  pintar(nombre: string) {
    this.alObservar({ getEntriesByName: (n) => (n === nombre ? [{ name: n }] : []) })
  }
}

describe('programarObservabilidad', () => {
  let alQuedarLibre: (() => void) | undefined
  const requestIdleCallback = vi.fn((cb: () => void) => {
    alQuedarLibre = cb
    return 1
  })

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    mocks.cargados.length = 0
    alQuedarLibre = undefined
    PerformanceObserverFalso.instancias.length = 0
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@sentry.example/1')
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_abc')
    vi.stubGlobal('PerformanceObserver', PerformanceObserverFalso)
    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  async function programar() {
    const { programarObservabilidad } = await import('./observability')
    programarObservabilidad(routerFalso())
    const [observador] = PerformanceObserverFalso.instancias
    if (!observador) throw new Error('no se creó el PerformanceObserver')
    return observador
  }

  async function esperarInicializadas() {
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(mocks.sentryInit).toHaveBeenCalledOnce()
      expect(mocks.posthogInit).toHaveBeenCalledOnce()
    })
  }

  it('no descarga nada hasta el primer pintado con contenido, y después espera a que el navegador quede libre', async () => {
    const observador = await programar()
    expect(observador.observado).toEqual({ type: 'paint', buffered: true })

    observador.pintar('first-paint')
    expect(requestIdleCallback).not.toHaveBeenCalled()

    observador.pintar('first-contentful-paint')
    expect(observador.desconectado).toBe(true)
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 })
    await vi.dynamicImportSettled()
    expect(mocks.cargados).toEqual([])

    alQuedarLibre?.()
    await esperarInicializadas()
  })

  it('una pestaña que nunca pinta las inicia igual a los 5 s, una sola vez', async () => {
    const observador = await programar()

    vi.advanceTimersByTime(4999)
    expect(requestIdleCallback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    observador.pintar('first-contentful-paint')
    expect(requestIdleCallback).toHaveBeenCalledOnce()

    alQuedarLibre?.()
    await esperarInicializadas()
  })

  it('sin PerformanceObserver las inicia a los 5 s', async () => {
    vi.stubGlobal('PerformanceObserver', undefined)
    const { programarObservabilidad } = await import('./observability')

    programarObservabilidad(routerFalso())
    vi.advanceTimersByTime(4999)
    expect(requestIdleCallback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    alQuedarLibre?.()
    await esperarInicializadas()
  })

  it('sin requestIdleCallback (Safari) las inicia en la tarea siguiente al pintado', async () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    const observador = await programar()

    observador.pintar('first-contentful-paint')
    expect(mocks.cargados).toEqual([])
    vi.advanceTimersByTime(0)
    await esperarInicializadas()
  })
})
