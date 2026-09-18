import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocaleProvider, useTranslation } from './useTranslation'

function Probe() {
  const { t, locale } = useTranslation()
  return (
    <div>
      <p>{t('login.submit')}</p>
      <p>locale: {locale}</p>
    </div>
  )
}

describe('LocaleProvider / useTranslation', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('invariante 7: es-AR es el default y usa voseo ("Ingresá", no "Ingresa")', async () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    )
    await screen.findByText('locale: es-AR')
    expect(screen.getByText('Ingresar')).not.toBeNull()
  })

  it('invariante 6: togglear re-renderiza sincrónicamente sin recargar la página', async () => {
    function Toggle() {
      const { locale, setLocale } = useTranslation()
      return (
        <button type="button" onClick={() => setLocale(locale === 'es-AR' ? 'en-US' : 'es-AR')}>
          toggle
        </button>
      )
    }

    render(
      <LocaleProvider>
        <Probe />
        <Toggle />
      </LocaleProvider>
    )
    await screen.findByText('Ingresar')

    fireEvent.click(screen.getByText('toggle'))

    await screen.findByText('Sign in')
    expect(screen.getByText('locale: en-US')).not.toBeNull()
    expect(window.localStorage.getItem('propnexus.lang')).toBe('en-US')
  })

  // SPEC-103 (F-04): `index.html` fija `lang="es"` una vez y el toggle nunca
  // lo tocaba — `document.documentElement.lang` seguía en "es" con la app
  // entera ya en inglés.
  it('invariante SPEC-103: document.documentElement.lang sigue al locale vigente, no solo al montar', async () => {
    function Toggle() {
      const { locale, setLocale } = useTranslation()
      return (
        <button type="button" onClick={() => setLocale(locale === 'es-AR' ? 'en-US' : 'es-AR')}>
          toggle
        </button>
      )
    }

    render(
      <LocaleProvider>
        <Probe />
        <Toggle />
      </LocaleProvider>
    )
    await screen.findByText('locale: es-AR')
    expect(document.documentElement.lang).toBe('es-AR')

    fireEvent.click(screen.getByText('toggle'))

    await screen.findByText('locale: en-US')
    expect(document.documentElement.lang).toBe('en-US')
  })

  it('persiste la locale elegida entre montajes (localStorage)', async () => {
    window.localStorage.setItem('propnexus.lang', 'en-US')

    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    )

    await screen.findByText('Sign in')
  })
})
