import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initObservability } from './observability'

vi.mock('@sentry/react', () => ({ init: vi.fn() }))
vi.mock('posthog-js', () => ({ default: { init: vi.fn() } }))

describe('initObservability', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SENTRY_DSN', '')
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    vi.stubEnv('VITE_POSTHOG_HOST', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('sin DSN ni key no inicializa ninguna de las dos herramientas', () => {
    initObservability()

    expect(Sentry.init).not.toHaveBeenCalled()
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('con DSN inicializa Sentry sin PII por defecto', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@sentry.example/1')

    initObservability()

    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: 'https://k@sentry.example/1',
      environment: 'test',
      sendDefaultPii: false
    })
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('con key y sin host inicializa PostHog en el host por defecto, sin autocapture ni grabación', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_abc')
    vi.stubEnv('VITE_POSTHOG_HOST', undefined as unknown as string)

    initObservability()

    expect(posthog.init).toHaveBeenCalledWith('phc_abc', {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      autocapture: false,
      disable_session_recording: true,
      capture_performance: true
    })
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('con key y host propio usa ese host', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_abc')
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://ph.example.com')

    initObservability()

    expect(posthog.init).toHaveBeenCalledWith(
      'phc_abc',
      expect.objectContaining({ api_host: 'https://ph.example.com' })
    )
  })
})
