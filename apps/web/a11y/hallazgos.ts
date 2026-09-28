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
  // Vacío desde el 2026-09-28: SPEC-113 y SPEC-114 cerraron. Una fila nueva
  // lleva la spec que la va a cerrar; ver el comentario de arriba.
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
