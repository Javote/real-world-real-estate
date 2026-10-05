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
