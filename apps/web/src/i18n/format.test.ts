import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, formatRelative } from './format'

// Regla 14: moneda, fecha y relativos salen de `Intl` con el locale activo. Los
// tests comparan CONTRA EL OTRO LOCALE, no contra un string fijo: lo que
// importa es que el locale cambie el resultado, no la forma exacta que elija la
// implementación de ICU del runtime.

describe('formatCurrency', () => {
  it('recibe unidades mínimas enteras y divide acá', () => {
    // 400000 centavos = US$ 4.000. Si el componente recibiera 4000 ya
    // dividido, esa división habría pasado por un float en algún lado.
    expect(formatCurrency(400000, 'USD', 'en-US')).toContain('4,000')
  })

  it('el separador cambia con el locale', () => {
    const es = formatCurrency(400000, 'USD', 'es-AR')
    const en = formatCurrency(400000, 'USD', 'en-US')
    expect(es).not.toBe(en)
  })
})

describe('formatDate', () => {
  it('el orden de los campos cambia con el locale', () => {
    const iso = '2026-03-09T12:00:00.000Z'
    expect(formatDate(iso, 'es-AR')).not.toBe(formatDate(iso, 'en-US'))
  })
})

describe('formatRelative', () => {
  const ahora = new Date('2026-03-09T12:00:00.000Z')

  it('elige la unidad más grande que aplique', () => {
    const hace2h = new Date('2026-03-09T10:00:00.000Z').toISOString()
    expect(formatRelative(hace2h, 'en-US', ahora)).toBe('2 hours ago')
  })

  it('traduce al locale activo', () => {
    const hace2h = new Date('2026-03-09T10:00:00.000Z').toISOString()
    expect(formatRelative(hace2h, 'es-AR', ahora)).toContain('hace')
  })

  it('usa palabras cuando corresponde ("ayer", no "hace 1 día")', () => {
    const ayer = new Date('2026-03-08T12:00:00.000Z').toISOString()
    expect(formatRelative(ayer, 'en-US', ahora)).toBe('yesterday')
  })
})
