import { readdirSync, readFileSync, statSync } from 'node:fs'
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

// SPEC-101. `--size-icon-sm/md/lg` no existían en `styles.css`: Tailwind v4 no
// genera la utilidad de un token que no existe y no emite ningún error, así
// que 52 usos quedaban cayendo al default de Lucide (24px) sin que nadie lo
// notara. La causa raíz era doble — faltaban los tokens Y no había guardia
// que mirara `src/**/*.tsx` — y esta sección cierra las dos.
//
// **M2-D3 nombra la escala de íconos por contexto, no por talla.** Sus cinco
// filas son los cinco nombres que ya existían en `styles.css`
// (`inline`/`pill`/`stat`/`nav`/`empty`); `sm`/`md`/`lg` nunca estuvieron en
// el entregable, así que agregarlos habría sido elegir tokens en vez de
// transcribirlos. El arreglo fue el inverso: los 52 usos se movieron a los
// nombres normativos.

/** Extrae `{ contexto, px }` de una tabla `| Columna | Npx... | ... |` del
 * entregable, cortando entre dos encabezados. Toma el primer `\d+px` de la
 * segunda columna — cubre casos como "20px in 40px badge" (queremos 20) y
 * "48px+" (queremos 48). */
function filasConPx(desde: string, hasta: string): Array<{ contexto: string; px: number }> {
  const bloque = d3.slice(d3.indexOf(desde), d3.indexOf(hasta))
  const filas: Array<{ contexto: string; px: number }> = []
  for (const linea of bloque.split('\n')) {
    const m = /^\|\s*([^|]+?)\s*\|\s*(\d+)px/.exec(linea.trim())
    if (m) filas.push({ contexto: m[1] as string, px: Number(m[2]) })
  }
  return filas
}

/** Extrae `{ token, px }` de la tabla de espaciado (`| s-N | N | ... |`).
 * `token` queda como aparece en la variable CSS (`s1`, no `1`): `--spacing-`
 * conserva la `s`, a diferencia de `--radius-`, que no lleva la `r`. */
function filasDeEspaciado(desde: string, hasta: string): Array<{ token: string; px: number }> {
  const bloque = d3.slice(d3.indexOf(desde), d3.indexOf(hasta))
  const filas: Array<{ token: string; px: number }> = []
  for (const linea of bloque.split('\n')) {
    const m = /^\|\s*s-([0-9]+)\s*\|\s*(\d+)\s*\|/.exec(linea.trim())
    if (m) filas.push({ token: `s${m[1]}`, px: Number(m[2]) })
  }
  return filas
}

/** Extrae `{ token, px }` de la tabla de radios (`| r-xxx | N | ... |`).
 * `token` es lo que sigue a `r-` (`md`, `full`, ...): la variable CSS es
 * `--radius-md`, sin la `r`. */
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

/** Los cinco nombres normativos de ícono, en el mismo orden que M2-D3 §Sizes.
 * No se leen del entregable —esos nombres son nuestra convención, M2-D3 solo
 * describe el contexto—, así que van fijos acá, uno por fila de la tabla. */
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
    // La spec que abrió esta guardia decía "los 3 radios" — el entregable
    // tiene 4 (r-md, r-lg, r-xl, r-full), y `styles.css` ya los tenía los
    // cuatro. Corrección medida, no la que traía la spec.
    expect(radios.length).toBe(4)
  })

  it.each(radios)('--radius-$token es $px px', ({ token, px }) => {
    expect(styles).toContain(`--radius-${token}: ${px}px`)
  })
})

// La mitad que faltaba: que una clase fantasma sea un test rojo, no un ícono
// del tamaño equivocado. Escanea `src/**/*.tsx` en busca de las familias de
// utilidad que salen de nuestros propios tokens (`size-icon-*`, la escala de
// espaciado en cualquier dirección — `p-s4`, `gap-x-s2`, `top-s12` — y
// `rounded-*`, directional incluido) y exige que el token exista en
// `styles.css`.

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

/** Cada clase encontrada, con el nombre de la variable CSS que debería
 * sustentarla. `rounded-t-md`/`rounded-b-xl` (direccionales) resuelven al
 * mismo token que su forma sin dirección — el radio es el mismo, solo cambia
 * qué esquinas lo llevan. */
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
