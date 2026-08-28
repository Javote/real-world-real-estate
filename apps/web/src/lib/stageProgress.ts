import type { TimelineStage } from '#/components/domain/ProgressTimeline'
import type { StatusTone } from '#/components/domain/StatusPill'

/** El estado del proyecto contra la matriz de M2-D3, sin inventar estados. */
export const TONO_PROYECTO: Record<string, StatusTone> = {
  planning: 'info',
  in_progress: 'pending',
  delayed: 'pending',
  completed: 'verified'
}

/** 0-100. Completados sobre el total; sin stages no hay avance que afirmar. */
export function avanceDeStages(stages: readonly { state: string }[]): number {
  if (!stages.length) return 0
  return Math.round((stages.filter((s) => s.state === 'Completed').length / stages.length) * 100)
}

/**
 * El nodo "actual" es el primero en curso u observado; si no hay, el primero
 * que no está completado. Si están todos completos, no hay current.
 */
export function timelineDeStages(
  stages: readonly { sequenceOrder: number; name: string; state: string }[]
): TimelineStage[] {
  const idxActual = stages.findIndex((s) => s.state === 'InProgress' || s.state === 'Observed')
  const idxPendiente = stages.findIndex((s) => s.state !== 'Completed')
  const idx = idxActual >= 0 ? idxActual : idxPendiente

  return stages.map((s, i) => ({
    sequenceOrder: s.sequenceOrder,
    name: s.name,
    state: s.state === 'Completed' ? 'completed' : i === idx ? 'current' : 'pending'
  }))
}

export function bajarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
