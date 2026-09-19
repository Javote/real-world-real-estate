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

/**
 * El anclaje **vigente** del stage: la ÚLTIMA transición con TXID, no la
 * primera.
 *
 * `GET /projects/:id/stages/:stageId` devuelve `events` ordenados por
 * `eventIndex asc`, así que un `.find()` devuelve la transición más **vieja**.
 * En un stage que recorrió la FSM entera —`Pending → InProgress → Observed →
 * InProgress → Completed`— eso es el arranque, no el cierre: el
 * `VerificationBadge` de la cabecera quedaba diciendo "Verificado" al lado de
 * `certifiedAt` con el TXID de una transición a **otro estado**.
 *
 * No es hipotético: "Terminaciones" de `torre-a` tiene `1` = `Pending →
 * InProgress` (`b28eb6cf…`) y `5` = `InProgress → Completed` (`e842c8ac…`), y
 * la pantalla mostraba el primero.
 *
 * Es M2-D4 §6.2 —*"the system never displays a proof signal that cannot be
 * substantiated"*— en su forma más literal: Depth 1 contesta "¿esto está
 * anclado?" sobre el estado **actual**, y el TXID tiene que ser el de ese
 * estado.
 */
export function anclajeVigenteDelStage<T extends { eventType: string; txid?: string | null }>(
  events: readonly T[]
): T | undefined {
  return events.filter((e) => e.eventType === 'STAGE_TRANSITION' && e.txid).at(-1)
}

/**
 * Cada segundo que pasa entre confirmar en la cadena y que alguien vuelva a
 * mirar la pantalla es tiempo que `GET /units/:id/news` no reconcilia
 * (D-077: el disparo es la lectura, no hay cron). Mientras esta pantalla
 * quede abierta con un evento todavía `Pending`, repreguntamos cada 10s para
 * que la confirmación llegue sin que el investor tenga que salir y volver.
 *
 * `false` apaga el polling — ni bien no queda nada pendiente, o si `news`
 * todavía no cargó (nada que mirar).
 */
export function intervaloDeNovedades(
  news: { status: string | null }[] | undefined
): number | false {
  return news?.some((n) => n.status === 'Pending') ? 10_000 : false
}

/**
 * Cuántos eventos pasaron de `Pending` a `Confirmed` entre dos lecturas del
 * poll (SPEC-104, F-03). Puro y testeable por la misma razón que
 * `anclajeVigenteDelStage`: la ruta de TanStack no se testea unitariamente.
 *
 * Es una cuenta, no una lista de anuncios — con la pestaña en background el
 * poll sigue corriendo (`refetchIntervalInBackground`) y varias confirmaciones
 * pueden acumularse entre dos renders; se anuncia una sola vez, agregado.
 */
export function confirmacionesNuevas(
  previo: { id: string; status: string | null }[],
  actual: { id: string; status: string | null }[]
): number {
  const estadoPrevio = new Map(previo.map((n) => [n.id, n.status]))
  return actual.filter((n) => estadoPrevio.get(n.id) === 'Pending' && n.status === 'Confirmed')
    .length
}
