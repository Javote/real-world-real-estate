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
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota')
    })
    expect(getStoredLocale()).toBe(DEFAULT_LOCALE)
    expect(() => setStoredLocale('en-US')).not.toThrow()
  })
})
