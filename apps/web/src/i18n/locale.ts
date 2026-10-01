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
  } catch {}
}
