import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCALE, getStoredLocale, setStoredLocale } from './locale'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('locale guardado', () => {
  it('sin valor, o con uno que no es un locale, es el default', () => {
    expect(getStoredLocale()).toBe(DEFAULT_LOCALE)
    window.localStorage.setItem('propnexus.lang', 'fr-FR')
    expect(getStoredLocale()).toBe(DEFAULT_LOCALE)
  })

  it('guarda y lee en-US', () => {
    setStoredLocale('en-US')
    expect(getStoredLocale()).toBe('en-US')
  })

  it('un storage que tira no rompe ni la lectura ni la escritura', () => {
    // El storage entero, no `Storage.prototype`: en happy-dom los métodos no salen del prototipo.
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('cuota')
      }
    } as unknown as Storage)
    expect(getStoredLocale()).toBe(DEFAULT_LOCALE)
    expect(() => setStoredLocale('en-US')).not.toThrow()
  })
})
