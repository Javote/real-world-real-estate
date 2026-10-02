import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Diccionario, esAR } from './dictionary'
import { LocaleProvider, useTranslation } from './useTranslation'

const carga = vi.hoisted(() => ({
  enUS: undefined as (() => Promise<unknown>) | undefined
}))

vi.mock('./dictionary', async (original) => {
  const real = await original<typeof import('./dictionary')>()
  return {
    ...real,
    diccionarioCargado: (locale: string) => (locale === 'es-AR' ? real.esAR : undefined),
    cargarDiccionario: (locale: string) =>
      locale === 'es-AR' ? Promise.resolve(real.esAR) : (carga.enUS?.() ?? new Promise(() => {}))
  }
})

const enUS = { ...esAR, 'login.submit': 'Sign in' } as Diccionario

function diferido() {
  let resolver!: (tabla: Diccionario) => void
  let rechazar!: (error: Error) => void
  const promesa = new Promise<Diccionario>((res, rej) => {
    resolver = res
    rechazar = rej
  })
  return { promesa, resolver, rechazar }
}

function Probe() {
  const { t, locale, setLocale } = useTranslation()
  return (
    <div>
      <p>{t('login.submit')}</p>
      <p>locale: {locale}</p>
      <button type="button" onClick={() => setLocale('en-US')}>
        en
      </button>
      <button type="button" onClick={() => setLocale('es-AR')}>
        es
      </button>
    </div>
  )
}

describe('LocaleProvider, mientras baja en-US', () => {
  beforeEach(() => window.localStorage.clear())

  afterEach(() => {
    cleanup()
    carga.enUS = undefined
  })

  it('con en-US guardado y sin bajar, pinta es-AR y cambia entero cuando llega', async () => {
    const enCurso = diferido()
    carga.enUS = () => enCurso.promesa
    window.localStorage.setItem('propnexus.lang', 'en-US')

    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    )
    expect(screen.getByText('Ingresar')).not.toBeNull()
    expect(document.documentElement.lang).toBe('es-AR')

    await act(async () => enCurso.resolver(enUS))

    expect(screen.getByText('Sign in')).not.toBeNull()
    expect(document.documentElement.lang).toBe('en-US')
  })

  it('un diccionario que llega tarde no pisa al último idioma pedido', async () => {
    const enCurso = diferido()
    carga.enUS = () => enCurso.promesa

    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    )
    fireEvent.click(screen.getByText('en'))
    fireEvent.click(screen.getByText('es'))
    await act(async () => enCurso.resolver(enUS))

    expect(screen.getByText('Ingresar')).not.toBeNull()
    expect(screen.getByText('locale: es-AR')).not.toBeNull()
    expect(window.localStorage.getItem('propnexus.lang')).toBe('es-AR')
  })

  it('si en-US no baja, queda el idioma vigente', async () => {
    const enCurso = diferido()
    carga.enUS = () => enCurso.promesa

    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    )
    fireEvent.click(screen.getByText('en'))
    await act(async () => enCurso.rechazar(new Error('sin red')))

    expect(screen.getByText('Ingresar')).not.toBeNull()
    expect(screen.getByText('locale: es-AR')).not.toBeNull()
  })
})
