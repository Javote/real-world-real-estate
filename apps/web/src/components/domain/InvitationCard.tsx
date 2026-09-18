import { Mail } from 'lucide-react'
import { cn } from '#/lib/cn'

// M2-D3 §Cards · InvitationCard — la variante de notificación reservada a las
// invitaciones a proyecto. *"Always pinned to the top of the list when
// unresolved."*
//
// El anclado al tope no lo decide este componente: es de la lista que lo
// ordena. Acá está la forma —acentos púrpura, sobre, CTA— y el estado
// `resolved`, que es lo que le dice a esa lista si sigue pineada.
//
// **La invitación siempre está anclada** (M2-D3 lo llama "non-optional" en el
// modal de aceptación): aceptar es el primer commitment del ciclo comercial
// (M3-SC-01). Este componente no muestra la prueba —eso es del modal—, solo
// abre la puerta.

interface InvitationCardProps {
  title: string
  /** Resumen de la oferta, ya armado y traducido por quien lo usa. */
  body: string
  /** "Ver invitación →" */
  ctaLabel: string
  /** Ya formateado con `Intl`. */
  timestampLabel: string
  /**
   * `false` mientras esté pendiente. Resuelta, la lista la devuelve al montón
   * normal con su estado en el cuerpo.
   */
  resolved?: boolean
  onOpen: () => void
  className?: string
}

export function InvitationCard({
  title,
  body,
  ctaLabel,
  timestampLabel,
  resolved,
  onOpen,
  className
}: InvitationCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-start gap-s3 rounded-lg border-l-4 border-l-primary bg-card p-s3 text-left shadow-e1',
        resolved && 'opacity-70',
        className
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-light">
        <Mail className="size-icon-inline text-primary" aria-hidden="true" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-s1">
        <span className="flex items-baseline justify-between gap-s2">
          <span className="truncate text-body font-bold text-primary">{title}</span>
          <span className="shrink-0 text-caption text-text-muted">{timestampLabel}</span>
        </span>
        <span className="text-body-sm text-text-secondary">{body}</span>
        {!resolved ? (
          <span className="text-body-sm font-medium text-primary">{ctaLabel}</span>
        ) : null}
      </span>
    </button>
  )
}
