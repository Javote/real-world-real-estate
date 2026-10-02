const DECIMALES = 2

export function majorToMinor(major: number | null): number | null {
  if (major === null || !Number.isFinite(major) || major < 0) return null

  const [entera, decimal = ''] = major.toString().split('.')
  if (decimal.includes('e') || entera.includes('e')) return null
  if (decimal.length > DECIMALES) return null

  const minor = Number(entera) * 10 ** DECIMALES + Number(decimal.padEnd(DECIMALES, '0'))
  return Number.isSafeInteger(minor) ? minor : null
}

export function minorToMajor(minor: number): number {
  return minor / 10 ** DECIMALES
}
