import { describe, expect, it } from 'vitest'
import { majorToMinor, minorToMajor } from '#/lib/money'

describe('majorToMinor', () => {
  it('convierte enteros y dos decimales de forma exacta', () => {
    expect(majorToMinor(285_000)).toBe(28_500_000)
    expect(majorToMinor(9_000_000)).toBe(900_000_000)
    expect(majorToMinor(0.01)).toBe(1)
    expect(majorToMinor(0.1)).toBe(10)
    expect(majorToMinor(0)).toBe(0)
  })

  // El caso que motivó el helper: en punto flotante 1234.56 × 100 da
  // 123456.00000000001, y `Math.round` lo tapa. Acá el producto nunca ocurre
  // sobre el decimal.
  it('no arrastra el error de punto flotante', () => {
    expect(majorToMinor(1234.56)).toBe(123_456)
    expect(majorToMinor(0.29)).toBe(29)
    expect(majorToMinor(8.29)).toBe(829)
  })

  // **Rechaza, no redondea.** Es la diferencia con `Math.round(x * 100)`.
  it('rechaza lo que no se puede representar en vez de inventar precisión', () => {
    expect(majorToMinor(285_000.567)).toBeNull()
    expect(majorToMinor(1.005)).toBeNull()
    expect(majorToMinor(-1)).toBeNull()
    expect(majorToMinor(Number.NaN)).toBeNull()
    expect(majorToMinor(Number.POSITIVE_INFINITY)).toBeNull()
    expect(majorToMinor(null)).toBeNull()
  })

  it('rechaza lo que se saldría del entero seguro', () => {
    expect(majorToMinor(Number.MAX_SAFE_INTEGER)).toBeNull()
  })

  // Cero no es vacío: es un monto, y quien valida decide si lo acepta.
  it('cero es un monto válido, no un null', () => {
    expect(majorToMinor(0)).toBe(0)
    expect(majorToMinor(0)).not.toBeNull()
  })
})

describe('minorToMajor', () => {
  it('es la inversa para todo lo que majorToMinor acepta', () => {
    for (const major of [285_000, 1234.56, 0.01, 9_000_000, 0]) {
      expect(minorToMajor(majorToMinor(major) as number)).toBe(major)
    }
  })
})

describe('majorToMinor con notación científica', () => {
  // `toString()` pasa a notación científica por encima de 1e21 y por debajo de 1e-6:
  // ahí no hay decimal que contar, y se rechaza en vez de interpretar mal el exponente.
  it.each([1e21, 1e-7, 1.5e-7])('rechaza %s', (valor) => {
    expect(majorToMinor(valor)).toBeNull()
  })
})
