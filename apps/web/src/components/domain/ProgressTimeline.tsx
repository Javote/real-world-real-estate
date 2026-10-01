import { cn } from '#/lib/cn'

export interface TimelineStage {
  sequenceOrder: number
  name: string
  state: 'completed' | 'current' | 'pending'
}

interface ProgressTimelineProps {
  stages: readonly TimelineStage[]
  currentLabel?: string
  finalizationLabel?: string
  ariaLabel: string
  onSelectStage?: (stage: TimelineStage) => void
  className?: string
}

const NODO: Record<TimelineStage['state'], string> = {
  completed: 'bg-primary border-primary',
  current: 'bg-card border-primary ring-2 ring-primary-light',
  pending: 'bg-card border-border'
}

export function ProgressTimeline({
  stages,
  currentLabel,
  finalizationLabel,
  ariaLabel,
  onSelectStage,
  className
}: ProgressTimelineProps) {
  return (
    <div className={cn('flex flex-col gap-s2', className)}>
      <ol aria-label={ariaLabel} className="flex items-center">
        {stages.map((stage, i) => (
          <li key={stage.sequenceOrder} className="flex flex-1 items-center last:flex-none">
            {onSelectStage ? (
              <button
                type="button"
                aria-label={stage.name}
                aria-current={stage.state === 'current' ? 'step' : undefined}
                onClick={() => onSelectStage(stage)}
                className={cn(
                  'relative size-4 shrink-0 rounded-full border-2 transition-colors',
                  'before:absolute before:-inset-1 before:content-[""]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  NODO[stage.state]
                )}
              />
            ) : (
              <span
                aria-current={stage.state === 'current' ? 'step' : undefined}
                title={stage.name}
                className={cn('size-4 shrink-0 rounded-full border-2', NODO[stage.state])}
              />
            )}

            {i < stages.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'h-0.5 flex-1',
                  stage.state === 'completed' ? 'bg-primary' : 'bg-border'
                )}
              />
            ) : null}
          </li>
        ))}
      </ol>

      {currentLabel || finalizationLabel ? (
        <div className="flex items-baseline justify-between gap-s2">
          {currentLabel ? (
            <span className="text-body-sm font-medium text-text-primary">{currentLabel}</span>
          ) : (
            <span />
          )}
          {finalizationLabel ? (
            <span className="text-caption text-text-muted">{finalizationLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
