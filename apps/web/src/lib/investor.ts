import type { StageState } from '@plataforma/shared'
import { ApiError } from '#/api/port'
import type { TranslationKey } from '#/i18n/dictionary'

export function reintentarSiNoEsAusencia(count: number, err: Error) {
  if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return false
  return count < 2
}

export function esFoto(evidenceType: string, mime: string) {
  return evidenceType === 'photo' || mime.startsWith('image/')
}

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

const CLAVE_ESTADO_STAGE: Record<StageState, TranslationKey> = {
  Pending: 'stage.state.Pending',
  InProgress: 'stage.state.InProgress',
  Observed: 'stage.state.Observed',
  Completed: 'stage.state.Completed'
}

export function claveEstadoStage(state: StageState): TranslationKey {
  return CLAVE_ESTADO_STAGE[state]
}

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

export function anclajeVigenteDelStage<T extends { eventType: string; txid?: string | null }>(
  events: readonly T[]
): T | undefined {
  return events.filter((e) => e.eventType === 'STAGE_TRANSITION' && e.txid).at(-1)
}

export function intervaloDeNovedades(
  news: { status: string | null }[] | undefined
): number | false {
  return news?.some((n) => n.status === 'Pending') ? 10_000 : false
}

export function confirmacionesNuevas(
  previo: { id: string; status: string | null }[],
  actual: { id: string; status: string | null }[]
): number {
  const estadoPrevio = new Map(previo.map((n) => [n.id, n.status]))
  return actual.filter((n) => estadoPrevio.get(n.id) === 'Pending' && n.status === 'Confirmed')
    .length
}
