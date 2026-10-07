import type { TranslationKey } from '#/i18n/dictionary'
import { ApiError } from './port'

type Opciones = {
  // El `code` del cuerpo que la pantalla sabe nombrar; gana sobre el status.
  porCodigo?: Partial<Record<string, TranslationKey>>
  generica?: TranslationKey
}

// La única traducción de un error de la API a una clave del diccionario.
export function claveDeError(err: unknown, opciones: Opciones = {}): TranslationKey {
  const generica = opciones.generica ?? 'error.generic'
  if (!(err instanceof ApiError)) return generica

  const codigo = codigoDe(err.body)
  const porCodigo = codigo ? opciones.porCodigo?.[codigo] : undefined
  if (porCodigo) return porCodigo

  if (err.status === 403) return 'error.forbidden'
  if (err.status === 404) return 'error.notFound'
  return generica
}

function codigoDe(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('code' in body)) return undefined
  return typeof body.code === 'string' ? body.code : undefined
}
