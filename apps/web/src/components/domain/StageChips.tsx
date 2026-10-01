import { cn } from '#/lib/cn'

export interface StageChipData {
  number: number
  anchored: boolean
  bundleId?: string
}

interface StageChipsProps {
  stages: readonly StageChipData[]
  onOpenStage?: (stage: StageChipData) => void
  ariaLabel: string
}

export function StageChips({ stages, onOpenStage, ariaLabel }: StageChipsProps) {
  return (
    <ul aria-label={ariaLabel} className="flex flex-wrap gap-s2">
      {stages.map((stage) => {
        const cliqueable = stage.anchored && onOpenStage
        return (
          <li key={stage.number}>
            <button
              type="button"
              disabled={!cliqueable}
              onClick={() => cliqueable && onOpenStage(stage)}
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
