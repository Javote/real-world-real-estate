import { cn } from '#/lib/cn'

// **No es un componente del catálogo de M2-D3: es una sub-parte** que el
// entregable describe adentro de dos componentes distintos — el pie del
// `ProjectCard` ("footer progress bar with percentage on the right") y las
// barras de completitud del panel del notary (M2-D5 fila 51).
//
// Vive suelto para no duplicarlo, no para agregar un componente que el
// entregable no tiene. Si algún día M2-D3 lo nombra, se le pone su nombre.

interface ProgressBarProps {
  /** 0-100. */
  percent: number
  /** El porcentaje a la derecha, como en el pie del ProjectCard. */
  showValue?: boolean
  className?: string
}

export function ProgressBar({ percent, showValue, className }: ProgressBarProps) {
  const acotado = Math.max(0, Math.min(100, Math.round(percent)))

  return (
    <div className={cn('flex items-center gap-s2', className)}>
      <div
        role="progressbar"
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
