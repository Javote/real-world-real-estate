import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  cargarDiccionario,
  type Diccionario,
  diccionarioCargado,
  esAR,
  type TranslationKey
} from './dictionary'
import { DEFAULT_LOCALE, getStoredLocale, type Locale, setStoredLocale } from './locale'

interface LocaleContextValue {
  locale: Locale
  tabla: Diccionario
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [vigente, setVigente] = useState<{ locale: Locale; tabla: Diccionario }>(() => {
    const guardada = getStoredLocale()
    const tabla = diccionarioCargado(guardada)
    return tabla ? { locale: guardada, tabla } : { locale: DEFAULT_LOCALE, tabla: esAR }
  })
  const pedida = useRef(vigente.locale)

  const aplicar = useCallback((next: Locale) => {
    pedida.current = next
    cargarDiccionario(next)
      .then((tabla) => {
        if (pedida.current === next) setVigente({ locale: next, tabla })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const guardada = getStoredLocale()
    if (guardada !== pedida.current) aplicar(guardada)
  }, [aplicar])

  useEffect(() => {
    document.documentElement.lang = vigente.locale
  }, [vigente.locale])

  const setLocale = useCallback(
    (next: Locale) => {
      setStoredLocale(next)
      aplicar(next)
    },
    [aplicar]
  )

  const value = useMemo(() => ({ ...vigente, setLocale }), [vigente, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useTranslation debe usarse dentro de LocaleProvider')
  const { tabla } = ctx

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string>) => {
      const plantilla = tabla[key]
      if (!params) return plantilla
      return plantilla.replace(
        /\{(\w+)\}/g,
        (original, nombre: string) => params[nombre] ?? original
      )
    },
    [tabla]
  )

  const tDinamico = useCallback(
    (clave: string, fallback: string) => {
      const porClave: Record<string, string> = tabla
      return porClave[clave] ?? fallback
    },
    [tabla]
  )

  return { t, tDinamico, locale: ctx.locale, setLocale: ctx.setLocale }
}
