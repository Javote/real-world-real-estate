import { AUDIT_ACTIONS } from '@plataforma/shared'
import { describe, expect, it } from 'vitest'
import { dictionary } from './dictionary'

// SPEC-207 (B-09): las 29 `action` que `writeAuditLog` puede escribir hoy
// (`packages/shared/src/audit.ts`) tienen que estar todas en el diccionario,
// en los dos locales, y el diccionario no puede tener claves `audit.action.*`
// que ya no correspondan a ninguna acción real — las dos muertas que dejaron
// las rutas borradas el 2026-09-08 (`CREATE_EVIDENCE`, `CREATE_STAGE`) eran
// exactamente ese caso. Sin este test, la paridad de las tres listas
// (`writeAuditLog`, `auditScope`, el diccionario) depende de que alguien se
// acuerde — que es el problema que abrió esta spec.

const AUDIT_ACTION_KEYS = AUDIT_ACTIONS.map((action) => `audit.action.${action}` as const)

describe('el diccionario de audit.action contra AUDIT_ACTIONS', () => {
  for (const locale of ['es-AR', 'en-US'] as const) {
    it(`${locale} tiene una clave por cada AuditAction`, () => {
      const faltantes = AUDIT_ACTION_KEYS.filter((key) => !(key in dictionary[locale]))
      expect(faltantes).toEqual([])
    })
  }

  for (const locale of ['es-AR', 'en-US'] as const) {
    it(`${locale} no tiene claves audit.action.* muertas`, () => {
      const declaradas = new Set(AUDIT_ACTION_KEYS as readonly string[])
      const sobrantes = Object.keys(dictionary[locale]).filter(
        (key) => key.startsWith('audit.action.') && !declaradas.has(key)
      )
      expect(sobrantes).toEqual([])
    })
  }
})
