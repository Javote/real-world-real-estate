import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = path.resolve(import.meta.dirname, '../../..')
const d3 = readFileSync(
  path.join(raiz, 'docs/milestone-2-diseno/M2-D3-Design-principles-and-component-library.md'),
  'utf8'
)
const styles = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8')

function coloresNormativos(): Array<{ nombre: string; hex: string }> {
  const visual = d3.slice(
    d3.indexOf('## Visual Language'),
    d3.indexOf('### Status pill colour matrix')
  )
  const lineas = visual.split('\n').map((l) => l.trim())
  const pares: Array<{ nombre: string; hex: string }> = []

  for (let i = 0; i < lineas.length - 1; i += 1) {
    const nombre = lineas[i]
    const hex = lineas[i + 1]
    if (/^[A-Z][A-Za-z /]+$/.test(nombre ?? '') && /^#[0-9A-Fa-f]{6}$/.test(hex ?? '')) {
      pares.push({ nombre: nombre as string, hex: (hex as string).toLowerCase() })
    }
  }
  return pares
}

const normativos = coloresNormativos()

const BASE = ['#ffffff', '#f4f1ed', '#f3f4f6']
const RELLENOS = ['#d4f4ee', '#ffe8d6', '#dbeafe', '#fce7f3']
const DESVIOS: Record<string, { nuevo: string; fondos: string[] }> = {
  '#14b8a6': { nuevo: '#0f766e', fondos: [...BASE, '#d4f4ee'] },
  '#f97316': { nuevo: '#b43f0b', fondos: [...BASE, '#ffe8d6'] },
  '#3b82f6': { nuevo: '#1d4ed8', fondos: [...BASE, '#dbeafe'] },
  '#ec4899': { nuevo: '#be185d', fondos: [...BASE, '#fce7f3'] },
  '#ef4444': { nuevo: '#b91c1c', fondos: BASE },
  '#6b7280': { nuevo: '#5f6673', fondos: [...BASE, ...RELLENOS] }
}

function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

describe('tokens de color contra M2-D3', () => {
  it('el entregable define los colores que esperamos encontrar', () => {
    expect(normativos.length).toBeGreaterThanOrEqual(17)
  })

  it.each(normativos)('$nombre ($hex) está en styles.css, o su desvío de D-098', ({ hex }) => {
    const desvio = DESVIOS[hex]
    if (desvio) {
      expect(styles.toLowerCase()).toContain(desvio.nuevo)
      expect(styles.toLowerCase()).not.toContain(hex)
    } else {
      expect(styles.toLowerCase()).toContain(hex)
    }
  })

  it('los seis desvíos de D-098 existen en el entregable y siguen pasando 4.5:1', () => {
    const hexes = normativos.map((n) => n.hex)
    for (const [viejo, { nuevo, fondos }] of Object.entries(DESVIOS)) {
      expect(hexes).toContain(viejo)
      for (const fondo of fondos) {
        expect(contraste(nuevo, fondo), `${nuevo} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('no quedó ningún color del sistema viejo', () => {
    for (const viejo of ['#3182ce', '#38a169', '#2d3748']) {
      expect(styles.toLowerCase()).not.toContain(viejo)
    }
  })
})

describe('reglas del sistema', () => {
  it('la escala de espaciado es la de 4px del entregable', () => {
    for (const px of ['4px', '8px', '12px', '16px', '20px', '24px', '32px', '48px']) {
      expect(styles).toContain(
        `--spacing-s${{ '4px': 1, '8px': 2, '12px': 3, '16px': 4, '20px': 5, '24px': 6, '32px': 8, '48px': 12 }[px]}: ${px}`
      )
    }
  })

  it('hay dos tamaños monoespaciados, y son solo para hashes', () => {
    expect(styles).toContain('--text-mono-sm: 12px')
    expect(styles).toContain('--text-mono-body: 14px')
  })

  it('el número del StatCard es más grande que el h1, a propósito', () => {
    const stat = Number(/--text-stat: (\d+)px/.exec(styles)?.[1])
    const h1 = Number(/--text-h1: (\d+)px/.exec(styles)?.[1])
    expect(stat).toBeGreaterThan(h1)
  })
})

function filasConPx(desde: string, hasta: string): Array<{ contexto: string; px: number }> {
  const bloque = d3.slice(d3.indexOf(desde), d3.indexOf(hasta))
  const filas: Array<{ contexto: string; px: number }> = []
  for (const linea of bloque.split('\n')) {
    const m = /^\|\s*([^|]+?)\s*\|\s*(\d+)px/.exec(linea.trim())
    if (m) filas.push({ contexto: m[1] as string, px: Number(m[2]) })
  }
  return filas
}

function filasDeEspaciado(desde: string, hasta: string): Array<{ token: string; px: number }> {
  const bloque = d3.slice(d3.indexOf(desde), d3.indexOf(hasta))
  const filas: Array<{ token: string; px: number }> = []
  for (const linea of bloque.split('\n')) {
    const m = /^\|\s*s-([0-9]+)\s*\|\s*(\d+)\s*\|/.exec(linea.trim())
    if (m) filas.push({ token: `s${m[1]}`, px: Number(m[2]) })
  }
  return filas
}

function filasDeRadios(desde: string, hasta: string): Array<{ token: string; px: number }> {
  const bloque = d3.slice(d3.indexOf(desde), d3.indexOf(hasta))
  const filas: Array<{ token: string; px: number }> = []
  for (const linea of bloque.split('\n')) {
    const m = /^\|\s*r-([a-z0-9]+)\s*\|\s*(\d+)\s*\|/.exec(linea.trim())
    if (m) filas.push({ token: m[1] as string, px: Number(m[2]) })
  }
  return filas
}

const tamañosDeIcono = filasConPx('### Sizes', '## Spacing')
const espaciado = filasDeEspaciado('### Spacing tokens', '### Radii')
const radios = filasDeRadios('### Radii', '### Elevation')

const NOMBRES_DE_ICONO = ['inline', 'pill', 'stat', 'nav', 'empty']

describe('tokens de tamaño e ícono contra M2-D3 (SPEC-101)', () => {
  it('el entregable define las cinco filas de Sizes que esperamos', () => {
    expect(tamañosDeIcono.length).toBe(5)
  })

  it.each(tamañosDeIcono.map((fila, i) => ({ ...fila, nombre: NOMBRES_DE_ICONO[i] })))(
    '$contexto ($px px) es --size-icon-$nombre',
    ({ nombre, px }) => {
      expect(styles).toContain(`--size-icon-${nombre}: ${px}px`)
    }
  )

  it('ningún token de ícono fuera de los cinco de M2-D3', () => {
    const declarados = [...styles.matchAll(/--size-icon-([a-z]+):/g)].map((m) => m[1])
    expect(declarados.sort()).toEqual([...NOMBRES_DE_ICONO].sort())
  })

  it('el entregable define los ocho tokens de espaciado que esperamos', () => {
    expect(espaciado.length).toBe(8)
  })

  it.each(espaciado)('--spacing-$token es $px px', ({ token, px }) => {
    expect(styles).toContain(`--spacing-${token}: ${px}px`)
  })

  it('el entregable define los cuatro radios que esperamos', () => {
    expect(radios.length).toBe(4)
  })

  it.each(radios)('--radius-$token es $px px', ({ token, px }) => {
    expect(styles).toContain(`--radius-${token}: ${px}px`)
  })
})

function archivosTsx(dir: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === 'dist') continue
    const completo = path.join(dir, entrada)
    if (statSync(completo).isDirectory()) salida.push(...archivosTsx(completo))
    else if (entrada.endsWith('.tsx')) salida.push(completo)
  }
  return salida
}

const SRC = path.join(import.meta.dirname)

type Hallazgo = { archivo: string; clase: string; token: string }

function hallazgosDeUnArchivo(archivo: string): Hallazgo[] {
  const contenido = readFileSync(archivo, 'utf8')
  const relativo = path.relative(SRC, archivo)
  const hallazgos: Hallazgo[] = []

  for (const m of contenido.matchAll(/\bsize-icon-([a-z]+)\b/g)) {
    hallazgos.push({ archivo: relativo, clase: m[0], token: `--size-icon-${m[1]}` })
  }
  for (const m of contenido.matchAll(/\b[a-z]+-s(\d+)\b/g)) {
    hallazgos.push({ archivo: relativo, clase: m[0], token: `--spacing-s${m[1]}` })
  }
  for (const m of contenido.matchAll(/\brounded(?:-(?:t|r|b|l|tl|tr|br|bl))?-([a-z0-9]+)\b/g)) {
    hallazgos.push({ archivo: relativo, clase: m[0], token: `--radius-${m[1]}` })
  }
  return hallazgos
}

const hallazgos = archivosTsx(SRC).flatMap(hallazgosDeUnArchivo)

describe('ninguna clase fantasma en src/**/*.tsx (SPEC-101)', () => {
  it('el escaneo encuentra usos reales — si esto da 0, el patrón dejó de matchear', () => {
    expect(hallazgos.length).toBeGreaterThan(100)
  })

  it.each(hallazgos)('$archivo: $clase → $token', ({ token }) => {
    expect(styles).toContain(`${token}:`)
  })
})
