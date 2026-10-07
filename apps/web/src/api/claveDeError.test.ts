import { ERROR_CODES } from '@plataforma/shared/errors'
import { describe, expect, it } from 'vitest'
import { esAR } from '#/i18n/dictionary'
import { claveDeError } from './claveDeError'
import { ApiError } from './port'

describe('ERROR_CODES de shared', () => {
  it.each(Object.entries(ERROR_CODES))(
    '%s nombra una clave que existe en el diccionario',
    (_c, { clave }) => {
      expect(Object.keys(esAR)).toContain(clave)
    }
  )
})

describe('claveDeError', () => {
  it('403 y 404 tienen su clave propia', () => {
    expect(claveDeError(new ApiError(403, 'Forbidden'))).toBe('error.forbidden')
    expect(claveDeError(new ApiError(404, 'Not Found'))).toBe('error.notFound')
  })

  it('cualquier otro status, o algo que no es un ApiError, cae en la genérica', () => {
    expect(claveDeError(new ApiError(500, 'Internal'))).toBe('error.generic')
    expect(claveDeError(new ApiError(409, 'Conflict', { code: 'X' }))).toBe('error.generic')
    expect(claveDeError(new TypeError('Failed to fetch'))).toBe('error.generic')
    expect(claveDeError(undefined)).toBe('error.generic')
  })

  it('la pantalla puede elegir su genérica', () => {
    expect(claveDeError(new ApiError(500, 'x'), { generica: 'admin.error.generic' })).toBe(
      'admin.error.generic'
    )
  })

  it('un code que la pantalla nombra gana sobre el status', () => {
    const porCodigo = { ALREADY_MEMBER: 'admin.error.ALREADY_MEMBER' } as const
    expect(claveDeError(new ApiError(409, 'x', { code: 'ALREADY_MEMBER' }), { porCodigo })).toBe(
      'admin.error.ALREADY_MEMBER'
    )
    expect(claveDeError(new ApiError(403, 'x', { code: 'ALREADY_MEMBER' }), { porCodigo })).toBe(
      'admin.error.ALREADY_MEMBER'
    )
  })

  it('un code desconocido o un cuerpo raro no rompen: decide el status', () => {
    const porCodigo = { ALREADY_MEMBER: 'admin.error.ALREADY_MEMBER' } as const
    expect(claveDeError(new ApiError(404, 'x', { code: 'OTRO' }), { porCodigo })).toBe(
      'error.notFound'
    )
    expect(claveDeError(new ApiError(403, 'x', 'texto'), { porCodigo })).toBe('error.forbidden')
    expect(claveDeError(new ApiError(403, 'x', { code: 7 }), { porCodigo })).toBe('error.forbidden')
  })
})
