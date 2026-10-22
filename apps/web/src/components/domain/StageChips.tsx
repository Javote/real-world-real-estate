import { cn } from '#/lib/cn'

export interface StageChipData {
  number: number
  anchored: boolean
  bundleId?: string
}

interface StageChipsProps {
  stages: readonly StageChipData[]
  onOpenStage?: (bundleId: string) => void
  ariaLabel: string
}

export function StageChips({ stages, onOpenStage, ariaLabel }: StageChipsProps) {
  return (
    <ul aria-label={ariaLabel} className="flex flex-wrap gap-s2">
      {stages.map((stage) => {
        // Se toca si hay un paquete que abrir: anclada sin paquete no tiene evidencia que mostrar.
        const { bundleId } = stage
        const cliqueable = stage.anchored && bundleId && onOpenStage
        return (
          <li key={stage.number}>
            <button
              type="button"
              disabled={!cliqueable}
              onClick={() => cliqueable && onOpenStage(bundleId)}
              aria-current={stage.anchored ? 'true' : undefined}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-md text-body-sm font-bold',
                stage.anchored
                  ? 'bg-primary-light text-primary-dark'
                  : 'bg-surface-alt text-disabled'
              )}
            >
              {stage.number}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
