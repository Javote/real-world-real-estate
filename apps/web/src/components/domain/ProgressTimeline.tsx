import { cn } from '#/lib/cn'

// M2-D3 §Cards · ProgressTimeline — *"Horizontal milestone timeline with one
// node per stage."*
//
// **Es la dimensión de OBRA, no la de prueba.** `StageChips` (P9) muestra qué
// está anclado; esto muestra en qué etapa va la construcción. Dos preguntas
// distintas, dos componentes distintos — M2-D4 §6.1: *"patterns compose, never
// overlap"*.
//
// El entregable dice "10 nodes". El componente recibe los stages que existan:
// diez es el largo de la plantilla, no una constante del dominio, y un proyecto
// con ocho etapas no puede dibujar dos nodos fantasma.

export interface TimelineStage {
  /** 1..n — el orden de obra. */
  sequenceOrder: number
  name: string
  state: 'completed' | 'current' | 'pending'
}

interface ProgressTimelineProps {
  stages: readonly TimelineStage[]
  /** Etiqueta de la etapa actual, debajo de la línea (M2-D3). */
  currentLabel?: string
  /** Fecha de finalización estimada, ya formateada con `Intl` (regla 14). */
  finalizationLabel?: string
  ariaLabel: string
  onSelectStage?: (stage: TimelineStage) => void
  className?: string
}

const NODO: Record<TimelineStage['state'], string> = {
  // Completado — círculo lleno púrpura.
  completed: 'bg-primary border-primary',
  // Actual — círculo abierto con anillo púrpura.
  current: 'bg-card border-primary ring-2 ring-primary-light',
  // Pendiente — círculo abierto gris.
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
                  'size-4 shrink-0 rounded-full border-2 transition-colors',
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

            {/* La línea que une. El último nodo no la lleva. */}
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
