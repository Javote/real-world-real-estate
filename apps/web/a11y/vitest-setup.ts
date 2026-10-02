import { cleanup } from '@testing-library/react'
import { type RunOptions, run } from 'axe-core'
import { afterEach, expect } from 'vitest'
import { describir, violacionesNuevas } from './hallazgos'

const SOLO_EN_NAVEGADOR: RunOptions['rules'] = {
  'color-contrast': { enabled: false },
  region: { enabled: false },
  'landmark-unique': { enabled: false }
}

afterEach(async () => {
  if (!document.body.innerHTML.trim()) return
  const resultado = await run(document.body, { rules: SOLO_EN_NAVEGADOR })
  const nuevas = violacionesNuevas(resultado.violations)
  if (nuevas.length > 0) {
    cleanup()
    expect.fail(
      `Violaciones de accesibilidad no registradas en a11y/hallazgos.ts:\n\n${describir(nuevas)}`
    )
  }
})
