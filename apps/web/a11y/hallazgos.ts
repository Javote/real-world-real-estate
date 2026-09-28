// Los hallazgos de accesibilidad ABIERTOS, con la spec que los va a cerrar
// (SPEC-112 §Alcance: un defecto real no se parchea en el momento, se vuelve
// su propia spec `1xx`).
//
// Lo importan las dos capas automatizadas —`test:a11y` (Vitest, `./vitest-setup.ts`)
// y `e2e/a11y.spec.ts` (Playwright)—, así que una violación conocida está
// escrita UNA vez. Todo lo que no calce acá es una violación nueva y hace
// fallar la capa: el registro no es un silenciador general, es la lista de lo
// que ya tiene dueño.
//
// **Cerrar un hallazgo es borrar su fila.** Si la spec se implementa y la fila
// queda, deja de proteger contra una regresión de lo que se acaba de arreglar.
//
// Se matchea por regla de axe + un patrón sobre el HTML del nodo (lo único que
// traen igual los resultados de axe en jsdom y en el navegador). El patrón es
// lo más angosto que identifica al componente, no a la regla entera.

export interface Hallazgo {
  /** El `id` de la regla de axe-core. */
  regla: string
  /** Sobre `node.html` de axe: identifica el componente, no la regla. */
  html: RegExp
  /** La spec que lo cierra. */
  spec: `SPEC-${number}`
  /** Una línea: qué está mal, dicho para quien lo va a arreglar. */
  motivo: string
}

export const HALLAZGOS_ABIERTOS: readonly Hallazgo[] = [
  // ── SPEC-113 · contraste: los tokens normativos de M2-D3 no dan 4.5:1 ──
  // Solo lo mide el navegador (jsdom no calcula colores).
  {
    regla: 'color-contrast',
    html: /\btext-pending\b/,
    spec: 'SPEC-113',
    motivo: '#f97316 sobre #ffe8d6 da 2.37:1 (pill Pendiente/En obra) y 2.8:1 sobre blanco'
  },
  {
    regla: 'color-contrast',
    html: /\btext-verified\b/,
    spec: 'SPEC-113',
    motivo: '#14b8a6 sobre #d4f4ee da 2.13:1 (encabezado del dossier, pill Vendida)'
  },
  {
    regla: 'color-contrast',
    html: /\btext-info\b/,
    spec: 'SPEC-113',
    motivo:
      '#3b82f6 sobre #dbeafe da 3.01:1 (pill info) — calculado, ninguna pantalla recorrida lo mostró todavía'
  },
  {
    regla: 'color-contrast',
    html: /\btext-text-muted\b/,
    spec: 'SPEC-113',
    motivo: '#6b7280 sobre #f4f1ed da 4.29:1 y sobre #d4f4ee 4.13:1'
  },
  {
    regla: 'color-contrast',
    html: /\btext-white\/80\b/,
    spec: 'SPEC-113',
    motivo: 'blanco al 80% sobre #6d4aff da 3.88:1 (subtítulo de ActionCard destacada)'
  },
  {
    regla: 'color-contrast',
    html: /color: rgb\(107, 114, 128\)/,
    spec: 'SPEC-113',
    motivo:
      'login: color inline #6b7280 sobre #f4f1ed (4.29:1) — y además es un color literal fuera de los tokens'
  }
]

/** Lo mínimo de un resultado de axe que hace falta para filtrar — igual en jsdom y en Playwright. */
interface Violacion {
  id: string
  nodes: readonly { html: string }[]
}

/**
 * Las violaciones que NO están registradas, con solo los nodos no registrados.
 * Una regla con un nodo conocido y otro nuevo sigue apareciendo, con el nuevo.
 */
export function violacionesNuevas<V extends Violacion>(violaciones: readonly V[]): V[] {
  return violaciones
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter(
        (n) => !HALLAZGOS_ABIERTOS.some((h) => h.regla === v.id && h.html.test(n.html))
      )
    }))
    .filter((v) => v.nodes.length > 0)
}

/** Una violación por línea, legible en el mensaje de un test que falla. */
export function describir(violaciones: readonly (Violacion & { help?: string })[]): string {
  return violaciones
    .map(
      (v) =>
        `[${v.id}] ${v.help ?? ''}\n${v.nodes.map((n) => `  ${n.html.slice(0, 200)}`).join('\n')}`
    )
    .join('\n\n')
}
