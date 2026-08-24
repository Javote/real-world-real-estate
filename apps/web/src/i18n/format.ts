import type { Locale } from './locale'

// Formateo con `Intl` y el locale activo (regla 14 / D-025).
//
// **Ningún componente arma un número o una fecha a mano.** No es prolijidad: en
// `es-AR` el separador decimal es coma y el de miles es punto, y las fechas van
// día/mes. Una fecha `toLocaleDateString()` sin locale explícito usa el del
// navegador, que no es el que el usuario eligió en la app — y entonces la fecha
// dice una cosa y el resto de la pantalla otra.

/**
 * Montos en la moneda que venga del backend.
 *
 * **El monto llega en la unidad mínima entera** (centavos, regla 1: dinero
 * jamás en float) y se divide acá. Recibir el número ya dividido sería aceptar
 * que alguien hizo esa cuenta en punto flotante antes.
 */
export function formatCurrency(minorUnits: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(minorUnits / 100)
}

/** Números grandes en la forma compacta de las StatCards: "4,0 M". */
export function formatCompact(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  )
}

/** Fecha corta. El input es ISO —lo que manda el backend—, nunca un `Date` local. */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

/** Fecha + hora, para los eventos del audit log y los anclajes. */
export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  )
}

/** "hace 2 horas" / "2 hours ago" — la metadata de M2-D3 §Caption. */
export function formatRelative(iso: string, locale: Locale, now: Date = new Date()): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const segundos = (new Date(iso).getTime() - now.getTime()) / 1000

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
