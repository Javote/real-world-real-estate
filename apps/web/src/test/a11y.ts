import { type AxeResults, run } from 'axe-core'
import { expect } from 'vitest'

expect.extend({
  toHaveNoViolations(results: AxeResults) {
    const violations = results.violations ?? []
    if (violations.length === 0) return { pass: true, message: () => '' }
    const message = violations
      .map((v) => `[${v.id}] ${v.help}\nHTML afectado: ${v.nodes.map((n) => n.html).join(', ')}`)
      .join('\n\n')
    return { pass: false, message: () => `Violaciones de accesibilidad:\n\n${message}` }
  }
})

export async function axe(container: Element) {
  return run(container) as unknown as AxeResults
}
