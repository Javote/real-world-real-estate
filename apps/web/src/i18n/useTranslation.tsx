// Contexto de locale (D-025). `propnexus.lang` es la única fuente de verdad:
// togglear re-renderiza sincrónicamente todos los strings, sin recargar la
// página (invariante 6 de SPEC-011).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { dictionary, type TranslationKey } from './dictionary'
import { DEFAULT_LOCALE, getStoredLocale, type Locale, setStoredLocale } from './locale'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Arranca en el default (SSR-safe) y se sincroniza con localStorage al
  // montar, igual que useRequireSession con la sesión: localStorage solo
  // existe en el cliente.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    setLocaleState(getStoredLocale())
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setStoredLocale(next)
    setLocaleState(next)
  }, [])

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useTranslation debe usarse dentro de LocaleProvider')

  const t = useCallback((key: TranslationKey) => dictionary[ctx.locale][key], [ctx.locale])

  return { t, locale: ctx.locale, setLocale: ctx.setLocale }
}
