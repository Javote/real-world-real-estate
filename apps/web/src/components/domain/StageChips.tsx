import { cn } from '#/lib/cn'

// **M2-D4 Pattern 9 · chips de anclaje por stage.**
//
// **Por qué diez chips y no una barra**, textual del entregable: los stages son
// eventos discretos con pruebas discretas. Una barra comunicaría progreso
// continuo; los chips comunican estado por stage, que es lo correcto — y además
// cada uno se puede tocar por separado.
//
// Esta es la dimensión *on-chain*, no la de obra: el `ProgressTimeline` muestra
// el avance de construcción, esto muestra qué está anclado.
//
// El componente **no carga los datos del bundle hasta que se toca un chip**
// (implementation cue del entregable): recibe solo el booleano y la ref.

export interface StageChipData {
  /** 1..10 — el número que se muestra. */
  number: number
  anchored: boolean
  /** Ref al bundle, para pedirlo cuando se toque. Ausente si no está anclado. */
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
                stage.anchored ? 'bg-primary-light text-primary' : 'bg-surface-alt text-disabled'
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
