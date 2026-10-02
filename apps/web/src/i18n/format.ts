import type { Locale } from './locale'

export function formatCurrency(minorUnits: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(minorUnits / 100)
}

export function formatCurrencyCompact(
  minorUnits: number,
  currency: string,
  locale: Locale
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(minorUnits / 100)
}

function fechaDe(iso: string | number): Date {
  if (typeof iso === 'number') return new Date(iso)
  if (/^\d{13}$/.test(iso)) return new Date(Number(iso))
  return new Date(iso)
}

export function formatCoordinate(grados: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5
  }).format(grados)
}

export function formatDate(iso: string | number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(fechaDe(iso))
}

export function formatMonthYear(iso: string | number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(fechaDe(iso))
}

export function formatDateTime(iso: string | number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    fechaDe(iso)
  )
}

export function formatRelative(
  iso: string | number,
  locale: Locale,
  now: Date = new Date()
): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const segundos = (fechaDe(iso).getTime() - now.getTime()) / 1000

  const unidades: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60]
  ]

  for (const [unidad, tamaño] of unidades) {
    if (Math.abs(segundos) >= tamaño) {
      return rtf.format(Math.round(segundos / tamaño), unidad)
    }
  }
  return rtf.format(Math.round(segundos), 'second')
}
