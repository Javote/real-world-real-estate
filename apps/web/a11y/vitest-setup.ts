import { cleanup } from '@testing-library/react'
import { type RunOptions, run } from 'axe-core'
import { afterEach, expect } from 'vitest'
import { describir, violacionesNuevas } from './hallazgos'

// La capa 2 de SPEC-112, en su forma de barrido: después de CADA test de la
// suite de `apps/web`, axe revisa el DOM que ese test dejó renderizado. Los
// ~1600 tests existentes ya montan cada componente de M2-D3 y cada ruta en sus
// estados reales (vacío, cargando, error, deshabilitado): escribir fixtures
// aparte para axe duplicaría eso y cubriría menos.
//
// Solo corre con `pnpm --filter web test:a11y` (`vitest.a11y.config.ts`), no
// en `pnpm test` ni en `pnpm verify`: SPEC-112 §Invariantes — ninguna capa
// automatizada de accesibilidad bloquea hoy.

// Reglas que jsdom no puede evaluar con verdad. Cada una se mide igual en el
// navegador real, en `e2e/a11y.spec.ts`: apagarlas acá no las saca de la vara.
const SOLO_EN_NAVEGADOR: RunOptions['rules'] = {
  // jsdom no calcula estilos: axe no puede medir contraste.
  'color-contrast': { enabled: false },
  // Los tests montan componentes sueltos, sin <main> alrededor: "contenido
  // fuera de landmarks" es la forma del test, no de la app.
  region: { enabled: false },
  // jsdom no aplica `hidden md:flex`, así que el Sidebar y el BottomNav se ven
  // a la vez y comparten nombre. En el navegador nunca coexisten visibles —
  // medido el 2026-09-28: la regla no aparece en ninguna de las 10 corridas e2e.
  'landmark-unique': { enabled: false }
}

afterEach(async () => {
  if (!document.body.innerHTML.trim()) return
  const resultado = await run(document.body, { rules: SOLO_EN_NAVEGADOR })
  const nuevas = violacionesNuevas(resultado.violations)
  if (nuevas.length > 0) {
    // Desmontar ANTES de fallar: un `afterEach` que tira corta los hooks que
    // quedan, el `cleanup` de Testing Library no corre, y el DOM de este test
    // contamina a todos los siguientes del archivo — medido: una violación en
    // un componente ponía rojos los 53 tests de `controls.test.tsx`.
    cleanup()
    expect.fail(
      `Violaciones de accesibilidad no registradas en a11y/hallazgos.ts:\n\n${describir(nuevas)}`
    )
  }
})
