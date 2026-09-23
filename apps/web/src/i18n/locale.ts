// D-025 / M2-D3 §Localization: la clave de localStorage es literal
// `propnexus.lang`, y `es-AR` es el default si no hay valor guardado.
export type Locale = 'es-AR' | 'en-US'

const STORAGE_KEY = 'propnexus.lang'
export const DEFAULT_LOCALE: Locale = 'es-AR'

function isLocale(value: unknown): value is Locale {
  return value === 'es-AR' || value === 'en-US'
}

export function getStoredLocale(): Locale {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isLocale(raw) ? raw : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function setStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // localStorage indisponible (modo privado, cuota): el toggle sigue
    // funcionando en memoria para la sesión de pestaña actual.
  }
}
