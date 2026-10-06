import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sentryInit: vi.fn(),
  posthogInit: vi.fn(),
  cargados: [] as string[]
}))

vi.mock('@sentry/react', () => {
  mocks.cargados.push('@sentry/react')
  return { init: mocks.sentryInit }
})
vi.mock('posthog-js', () => {
  mocks.cargados.push('posthog-js')
  return { default: { init: mocks.posthogInit } }
})

async function initObservability() {
  const modulo = await import('./observability')
  await modulo.initObservability()
}

describe('initObservability', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.cargados.length = 0
    vi.stubEnv('VITE_SENTRY_DSN', '')
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    vi.stubEnv('VITE_POSTHOG_HOST', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('sin DSN ni key no descarga ni inicializa ninguna de las dos herramientas', async () => {
    await initObservability()

    expect(mocks.cargados).toEqual([])
    expect(mocks.sentryInit).not.toHaveBeenCalled()
    expect(mocks.posthogInit).not.toHaveBeenCalled()
  })

  it('con DSN inicializa Sentry sin PII por defecto, y PostHog no se descarga', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@sentry.example/1')

    await initObservability()

    expect(mocks.sentryInit).toHaveBeenCalledWith({
      dsn: 'https://k@sentry.example/1',
      environment: 'test',
      sendDefaultPii: false
    })
    expect(mocks.cargados).toEqual(['@sentry/react'])
    expect(mocks.posthogInit).not.toHaveBeenCalled()
  })

  it('con key y sin host inicializa PostHog en el host por defecto, sin autocapture ni grabación, y Sentry no se descarga', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_abc')
    vi.stubEnv('VITE_POSTHOG_HOST', undefined as unknown as string)

    await initObservability()

    expect(mocks.posthogInit).toHaveBeenCalledWith('phc_abc', {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      autocapture: false,
      disable_session_recording: true,
      capture_performance: { web_vitals: true, network_timing: false },
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_exceptions: false,
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
      advanced_disable_flags: true
    })
    expect(mocks.cargados).toEqual(['posthog-js'])
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
    programarObservabilidad()
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

    programarObservabilidad()
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
