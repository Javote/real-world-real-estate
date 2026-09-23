// `findBy*` espera 1s por defecto (`asyncUtilTimeout`), y bajo carga (la
// suite de la API corriendo a la vez) el render tarda más — SPEC-019 §Paso 0,
// punto 5, reproducido el 2026-09-22: tres de tres corridas rojas con esa
// carga, cero sin ella.
import { configure } from '@testing-library/react'

configure({ asyncUtilTimeout: 5000 })

// jsdom no implementa `window.scrollTo` y `scrollRestoration` de TanStack Router
// lo llama en cada navegación: sin esto, cada test con `montarRuta` imprime
// "Not implemented: window.scrollTo" por stderr. Función plana, no `vi.fn`,
// para que `vi.restoreAllMocks()` de los tests no la deshaga.
window.scrollTo = () => {}

// Lo mismo con `HTMLCanvasElement.getContext`: axe-core lo pide (detección de
// ligaduras de íconos) y jsdom, sin el paquete `canvas`, imprime "Not
// implemented" por stderr. `null` es lo que devuelve un navegador sin contexto
// 2d, y axe lo trata como "no pude medir".
HTMLCanvasElement.prototype.getContext = () => null
