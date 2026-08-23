import type { MilestoneState } from '../../api/types'

const LABELS: Record<MilestoneState, { label: string; className: string }> = {
  Pending: { label: 'Pendiente', className: 'pending' },
  InProgress: { label: 'En progreso', className: 'inprogress' },
  Completed: { label: 'Completado', className: 'completed' },
  Observed: { label: 'Observado', className: 'observed' }
}

export function MilestoneStateBadge({ state }: { state: MilestoneState }) {
  const { label, className } = LABELS[state]
  return <span className={`status-badge ${className}`}>{label}</span>
}

export function MilestoneIndicator({ state }: { state: MilestoneState }) {
  const { className } = LABELS[state]
  const symbol =
    state === 'Completed' ? '✓' : state === 'InProgress' ? '●' : state === 'Observed' ? '!' : '○'
  return <div className={`milestone-indicator ${className}`}>{symbol}</div>
}
