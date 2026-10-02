import { AUDIT_ACTIONS } from '@plataforma/shared'
import { describe, expect, it } from 'vitest'
import { esAR } from './dictionary'
import { enUS } from './en-US'

const dictionary = { 'es-AR': esAR, 'en-US': enUS }

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
