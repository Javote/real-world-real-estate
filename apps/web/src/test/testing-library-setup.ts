// `findBy*` espera 1s por defecto (`asyncUtilTimeout`), y bajo carga (la
// suite de la API corriendo a la vez) el render tarda más — SPEC-019 §Paso 0,
// punto 5, reproducido el 2026-09-22: tres de tres corridas rojas con esa
// carga, cero sin ella.
import { configure } from '@testing-library/react'

configure({ asyncUtilTimeout: 5000 })
