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
      capture_performance: true
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

describe('programarObservabilidad', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.cargados.length = 0
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@sentry.example/1')
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_abc')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('no descarga nada hasta que el navegador queda libre después del primer pintado', async () => {
    let alQuedarLibre: (() => void) | undefined
    const requestIdleCallback = vi.fn((cb: () => void) => {
      alQuedarLibre = cb
      return 1
    })
    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
    const { programarObservabilidad } = await import('./observability')

    programarObservabilidad()
    await vi.dynamicImportSettled()

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 })
    expect(mocks.cargados).toEqual([])

    alQuedarLibre?.()
    await vi.waitFor(() => {
      expect(mocks.sentryInit).toHaveBeenCalled()
      expect(mocks.posthogInit).toHaveBeenCalled()
    })
  })

  it('sin requestIdleCallback espera al frame siguiente y a una tarea más', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', undefined)
    let alPintar: (() => void) | undefined
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: () => void) => {
        alPintar = cb
        return 1
      })
    )
    const { programarObservabilidad } = await import('./observability')

    programarObservabilidad()
    vi.runAllTimers()
    await vi.dynamicImportSettled()
    expect(mocks.cargados).toEqual([])

    alPintar?.()
    expect(mocks.cargados).toEqual([])
    vi.runAllTimers()
    vi.useRealTimers()
    await vi.waitFor(() => {
      expect(mocks.sentryInit).toHaveBeenCalled()
      expect(mocks.posthogInit).toHaveBeenCalled()
    })
  })
})
