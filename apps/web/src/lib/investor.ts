import { ApiError } from '#/api/port'
import type { TranslationKey } from '#/i18n/dictionary'

/** 403/404 no se reintentan: son la respuesta, no un fallo transitorio. */
export function reintentarSiNoEsAusencia(count: number, err: Error) {
  if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return false
  return count < 2
}

export function esFoto(evidenceType: string, mime: string) {
  return evidenceType === 'photo' || mime.startsWith('image/')
}

/** Etiqueta de formato del archivo, no copy de producto. */
export function formatoArchivo(mime: string, category: string) {
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'JPEG'
  if (mime.includes('png')) return 'PNG'
  return category
}

const CLAVE_NOVEDAD: Record<string, TranslationKey> = {
  STAGE_TRANSITION: 'investor.news.STAGE_TRANSITION',
  EVIDENCE_ANCHOR: 'investor.news.EVIDENCE_ANCHOR',
  INVITATION_ACCEPTED: 'investor.news.INVITATION_ACCEPTED',
  DOCUMENT_ANCHOR: 'investor.news.DOCUMENT_ANCHOR',
  PAYMENT_RELEASE: 'investor.news.PAYMENT_RELEASE',
  DOSSIER_SIGNATURE: 'investor.news.DOSSIER_SIGNATURE',
  STAGE_CREATED: 'investor.news.STAGE_CREATED'
}

export function claveNovedad(eventType: string): TranslationKey {
  return CLAVE_NOVEDAD[eventType] ?? 'investor.news.generic'
}

export function claveEstadoStage(state: string): TranslationKey {
  switch (state) {
    case 'Pending':
      return 'stage.state.Pending'
    case 'InProgress':
      return 'stage.state.InProgress'
    case 'Observed':
      return 'stage.state.Observed'
    case 'Completed':
      return 'stage.state.Completed'
    default:
      return 'status.pending'
  }
}

/**
 * GET /investor/units/:id joinea bundles y eventos: un stage se duplica.
 * P9 es un chip por etapa, no por fila del join. No se toca la API.
 */
export function unicosPorStageId<T extends { stageId: string; txid?: string | null }>(
  stages: readonly T[]
): T[] {
  const porId = new Map<string, T>()
  for (const s of stages) {
    const prev = porId.get(s.stageId)
    if (!prev) porId.set(s.stageId, s)
    else if (!prev.txid && s.txid) porId.set(s.stageId, s)
  }
  return [...porId.values()]
}
