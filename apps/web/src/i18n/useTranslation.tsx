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
  // Arranca en el default y se sincroniza con localStorage al montar, igual
  // que useRoleGuard con la sesión: evita leer localStorage antes del primer
  // render.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    setLocaleState(getStoredLocale())
  }, [])

  // SPEC-103 (F-04): `index.html` fija `lang="es"` una vez, al parsear el
  // documento — el toggle nunca lo tocaba. Se corre en cada cambio de
  // `locale`, no solo al montar, para que quede igual al vigente siempre.
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

  /**
   * Traduce, con interpolación simple de `{nombre}`.
   *
   * No es una librería de plurales ni de formato: para números, moneda y fechas
   * están los helpers de `i18n/format.ts` con `Intl` (regla 14). Esto resuelve
   * solo el caso de meter un valor dentro de una frase — "Welcome, {name}" —,
   * que en español y en inglés tiene distinto orden de palabras y por eso no se
   * puede concatenar a mano.
   */
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

  /**
   * SPEC-107 (F-14) — el escape explícito para claves que NO salen de una
   * unión cerrada de `packages/shared`: `titleKey` de una notificación es
   * `z.string()` porque el backend manda claves arbitrarias (regla 15) y no
   * hay forma de que el compilador verifique un conjunto que no existe en
   * ningún tipo. A diferencia de `as never` —que apaga el chequeo y
   * desaparece en el diff—, el fallback acá es **obligatorio** y se ve en
   * cada call site.
   */
  const tDinamico = useCallback(
    (clave: string, fallback: string) => {
      const tabla: Record<string, string> = dictionary[ctx.locale]
      return tabla[clave] ?? fallback
    },
    [ctx.locale]
  )

  return { t, tDinamico, locale: ctx.locale, setLocale: ctx.setLocale }
}
