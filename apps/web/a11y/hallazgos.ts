export interface Hallazgo {
  regla: string
  html: RegExp
  spec: `SPEC-${number}`
  motivo: string
}

export const HALLAZGOS_ABIERTOS: readonly Hallazgo[] = []

interface Violacion {
  id: string
  nodes: readonly { html: string }[]
}

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

export function describir(violaciones: readonly (Violacion & { help?: string })[]): string {
  return violaciones
    .map(
      (v) =>
        `[${v.id}] ${v.help ?? ''}\n${v.nodes.map((n) => `  ${n.html.slice(0, 200)}`).join('\n')}`
    )
    .join('\n\n')
}
