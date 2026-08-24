import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// **El valor dorado del sistema visual.**
//
// M2-D3 dice, literal, "Hex values are normative". Este test lee el entregable
// —no una copia, el archivo de `docs/`— y verifica que cada color normativo esté
// realmente en `styles.css`. Es el mismo patrón que en `contracts/`: un valor
// fijado de los dos lados, para que una divergencia salga como test rojo y no
// como una pantalla que se ve "parecida".
//
// Sin esto, la paleta se degrada de a un `#`: alguien ajusta un tono para que
// "quede mejor", nadie lo nota, y en seis pantallas ya no hay sistema.

const raiz = path.resolve(import.meta.dirname, '../../..')
const d3 = readFileSync(
  path.join(raiz, 'docs/milestone-2-diseno/M2-D3-Design-principles-and-component-library.md'),
  'utf8'
)
const styles = readFileSync(path.join(import.meta.dirname, 'styles.css'), 'utf8')

/** Los pares `Nombre` / `#HEX` de §Visual Language, tal como los lista el entregable. */
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

describe('tokens de color contra M2-D3', () => {
  it('el entregable define los colores que esperamos encontrar', () => {
    // Si este número cambia, alguien tocó `docs/` (que es inmutable) o el
    // parser dejó de entender el formato. Las dos cosas hay que mirarlas.
    expect(normativos.length).toBeGreaterThanOrEqual(17)
  })

  it.each(normativos)('$nombre ($hex) está en styles.css', ({ hex }) => {
    expect(styles.toLowerCase()).toContain(hex)
  })

  it('no quedó ningún color del sistema viejo', () => {
    // La paleta anterior era de otra familia entera y no compartía un solo
    // valor con la normativa (D-064). Estos tres eran sus más usados.
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
    // M2-D3: "intentionally heavier than Heading 1 to dominate dashboards".
    const stat = Number(/--text-stat: (\d+)px/.exec(styles)?.[1])
    const h1 = Number(/--text-h1: (\d+)px/.exec(styles)?.[1])
    expect(stat).toBeGreaterThan(h1)
  })
})
