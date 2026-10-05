import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cargarDiccionario } from './dictionary'
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

  it('invariante SPEC-103: document.documentElement.lang sigue al locale vigente, no solo al montar', async () => {
    function Toggle() {
      const { locale, setLocale } = useTranslation()
      return (
        <button type="button" onClick={() => setLocale(locale === 'es-AR' ? 'en-US' : 'es-AR')}>
          toggle
        </button>
      )
    }

    const vistos: [locale: string, lang: string][] = []
    function Espia() {
      const { locale } = useTranslation()
      vistos.push([locale, document.documentElement.lang])
      return null
    }

    render(
      <LocaleProvider>
        <Probe />
        <Toggle />
        <Espia />
      </LocaleProvider>
    )
    await screen.findByText('locale: es-AR')
    expect(document.documentElement.lang).toBe('es-AR')

    fireEvent.click(screen.getByText('toggle'))

    await screen.findByText('locale: en-US')
    expect(document.documentElement.lang).toBe('en-US')
    expect(vistos.filter(([locale, lang]) => locale !== lang)).toEqual([])
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

  it('con en-US guardado y su diccionario ya bajado, el primer render ya sale en inglés', async () => {
    window.localStorage.setItem('propnexus.lang', 'en-US')
    await cargarDiccionario('en-US')

    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    )

    expect(screen.getByText('Sign in')).not.toBeNull()
    expect(document.documentElement.lang).toBe('en-US')
  })

  it('tDinamico: devuelve la traducción si la clave existe en el diccionario', async () => {
    function ProbeDinamico() {
      const { tDinamico } = useTranslation()
      return <p>{tDinamico('login.submit', 'nunca se ve')}</p>
    }
    render(
      <LocaleProvider>
        <ProbeDinamico />
      </LocaleProvider>
    )
    await screen.findByText('Ingresar')
  })

  it('tDinamico: cae al fallback si la clave no existe', async () => {
    function ProbeDinamico() {
      const { tDinamico } = useTranslation()
      return <p>{tDinamico('esto.no.existe.en.el.diccionario', 'texto de respaldo')}</p>
    }
    render(
      <LocaleProvider>
        <ProbeDinamico />
      </LocaleProvider>
    )
    await screen.findByText('texto de respaldo')
  })
})

describe('useTranslation, bordes', () => {
  it('fuera del LocaleProvider tira', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('LocaleProvider')
    spy.mockRestore()
  })

  it('un {param} que no se pasa queda literal en la frase', async () => {
    function ProbeParams() {
      const { t } = useTranslation()
      return <p>{t('panel.welcome', { otro: 'x' })}</p>
    }
    render(
      <LocaleProvider>
        <ProbeParams />
      </LocaleProvider>
    )
    expect((await screen.findByText(/\{name\}/)).textContent).toContain('{name}')
  })
})
