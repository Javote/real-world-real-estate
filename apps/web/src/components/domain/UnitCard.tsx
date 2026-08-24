import { Home } from 'lucide-react'
import { cn } from '#/lib/cn'
import { ProgressBar } from './ProgressBar'
import { StatusPill, type StatusTone } from './StatusPill'

// M2-D3 §Cards · UnitCard — **dos variantes que el entregable separa
// explícitamente**, y la diferencia no es cosmética:
//
//   · **investor** — card con imagen, nombre de proyecto, unidad y barra de avance.
//   · **developer** — fila con ícono, piso + superficie + investor, pill y precio.
//     *"developer rows do not [include progress] — progress is at project level"*.
//
// Esa asimetría es D-029: el avance es del PROYECTO y es el mismo para todas
// las unidades hermanas. La variante del investor lo muestra porque es *su*
// unidad y le importa; la del developer no, porque repetiría el mismo número en
// cada fila de una lista de cuarenta.

interface UnitCardInvestorProps {
  variant: 'investor'
  unitReference: string
  projectName: string
  /** 0-100, del proyecto (D-029). */
  progress: number
  imageUrl?: string
  status: { tone: StatusTone; label: string }
  onOpen?: () => void
  className?: string
}

interface UnitCardDeveloperProps {
  variant: 'developer'
  unitReference: string
  /** Ya formateado: "Piso 7 · 85 m²". El componente no arma copy (D-025). */
  detailLine: string
  /** Nombre del investor, o la etiqueta de "sin asignar" ya traducida. */
  investorLabel: string
  /** Ya formateado con `Intl` (regla 1 y 14): nunca un número crudo. */
  priceLabel?: string
  status: { tone: StatusTone; label: string }
  onOpen?: () => void
  className?: string
}

type UnitCardProps = UnitCardInvestorProps | UnitCardDeveloperProps

export function UnitCard(props: UnitCardProps) {
  const Contenedor = props.onOpen ? 'button' : 'div'
  const interactivo = props.onOpen ? { type: 'button' as const, onClick: props.onOpen } : {}

  if (props.variant === 'developer') {
    return (
      <Contenedor
        {...interactivo}
        className={cn(
          'flex w-full items-center gap-s3 rounded-lg bg-card px-s3 py-s3 text-left shadow-e1',
          props.onOpen && 'transition-transform active:scale-[0.99]',
          props.className
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-light">
          <Home className="size-icon-sm text-primary" aria-hidden="true" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-medium text-text-primary">
            {props.unitReference}
          </span>
          <span className="truncate text-caption text-text-muted">{props.detailLine}</span>
          <span className="truncate text-caption text-text-muted">{props.investorLabel}</span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-s1">
          <StatusPill tone={props.status.tone}>{props.status.label}</StatusPill>
          {props.priceLabel ? (
            <span className="text-body-sm font-medium text-text-primary tabular-nums">
              {props.priceLabel}
            </span>
          ) : null}
        </span>
      </Contenedor>
    )
  }

  return (
    <Contenedor
      {...interactivo}
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-lg bg-card text-left shadow-e1',
        props.onOpen && 'transition-transform active:scale-[0.99]',
        props.className
      )}
    >
      {props.imageUrl ? (
        <img
          src={props.imageUrl}
          alt=""
          className="aspect-video w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span aria-hidden="true" className="aspect-video w-full bg-surface-alt" />
      )}

      <span className="flex flex-col gap-s2 p-s3">
        <span className="flex items-start justify-between gap-s2">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body font-medium text-text-primary">
              {props.unitReference}
            </span>
            <span className="truncate text-caption text-text-muted">{props.projectName}</span>
          </span>
          <StatusPill tone={props.status.tone}>{props.status.label}</StatusPill>
        </span>

        <ProgressBar percent={props.progress} showValue />
      </span>
    </Contenedor>
  )
}
