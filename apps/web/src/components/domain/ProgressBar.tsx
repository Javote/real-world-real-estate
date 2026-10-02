import { cn } from '#/lib/cn'

interface ProgressBarProps {
  percent: number
  label: string
  showValue?: boolean
  className?: string
}

export function ProgressBar({ percent, label, showValue, className }: ProgressBarProps) {
  const acotado = Math.max(0, Math.min(100, Math.round(percent)))

  return (
    <div className={cn('flex items-center gap-s2', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={acotado}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-alt"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${acotado}%` }} />
      </div>
      {showValue ? (
        <span className="text-body-sm font-medium text-text-secondary">{acotado}%</span>
      ) : null}
    </div>
  )
}
