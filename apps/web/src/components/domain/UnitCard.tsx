import { Home } from 'lucide-react'
import { cn } from '#/lib/cn'
import { useIntencion } from '#/lib/intencion'
import { ProgressBar } from './ProgressBar'
import { StatusPill, type StatusTone } from './StatusPill'

interface UnitCardInvestorProps {
  variant: 'investor'
  unitReference: string
  projectName: string
  progress: number
  imageUrl?: string
  status: { tone: StatusTone; label: string }
  onOpen?: () => void
  onIntent?: () => void
  className?: string
}

interface UnitCardDeveloperProps {
  variant: 'developer'
  unitReference: string
  detailLine: string
  investorLabel: string
  priceLabel?: string
  status: { tone: StatusTone; label: string }
  onOpen?: () => void
  onIntent?: () => void
  className?: string
}

type UnitCardProps = UnitCardInvestorProps | UnitCardDeveloperProps

export function UnitCard(props: UnitCardProps) {
  const intencion = useIntencion(props.onIntent)
  const Contenedor = props.onOpen ? 'button' : 'div'
  const interactivo = props.onOpen
    ? { type: 'button' as const, onClick: props.onOpen, ...intencion }
    : {}

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
          <Home className="size-icon-inline text-primary" aria-hidden="true" />
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
          decoding="async"
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

        <ProgressBar percent={props.progress} label={props.unitReference} showValue />
      </span>
    </Contenedor>
  )
}
