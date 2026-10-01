import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { dictionary, type TranslationKey } from './dictionary'
import { DEFAULT_LOCALE, getStoredLocale, type Locale, setStoredLocale } from './locale'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    setLocaleState(getStoredLocale())
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

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

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string>) => {
      const plantilla = dictionary[ctx.locale][key]
      if (!params) return plantilla
      return plantilla.replace(
        /\{(\w+)\}/g,
        (original, nombre: string) => params[nombre] ?? original
      )
    },
    [ctx.locale]
  )

  const tDinamico = useCallback(
    (clave: string, fallback: string) => {
      const tabla: Record<string, string> = dictionary[ctx.locale]
      return tabla[clave] ?? fallback
    },
    [ctx.locale]
  )

  return { t, tDinamico, locale: ctx.locale, setLocale: ctx.setLocale }
}
