import type { ProjectStatus } from '@plataforma/shared'
import type { TimelineStage } from '#/components/domain/ProgressTimeline'
import type { StatusTone } from '#/components/domain/StatusPill'

export const TONO_PROYECTO: Record<ProjectStatus, StatusTone> = {
  planning: 'info',
  in_progress: 'pending',
  delayed: 'pending',
  completed: 'verified'
}

export function avanceDeStages(stages: readonly { state: string }[]): number {
  if (!stages.length) return 0
  return Math.round((stages.filter((s) => s.state === 'Completed').length / stages.length) * 100)
}

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
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
