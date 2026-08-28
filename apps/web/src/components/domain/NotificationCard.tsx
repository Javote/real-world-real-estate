import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { cn } from '#/lib/cn'
import type { AuditCategory } from './AuditEventCard'

// M2-D3 §Cards · NotificationCard — la entrada estándar del inbox.
//
// **El texto llega traducido, no armado por el backend** (regla 15 y M2-D4
// §8.2): la API manda `titleKey` + `params` y quien usa este componente
// resuelve la clave con el locale activo. Este componente no sabe interpolar.
//
// **El borde de categoría solo aparece cuando la lista está filtrada por
// categoría** — M2-D3 es explícito: *"Category-coloured left border when
// category-filtered"*. Fuera de ese contexto sería ruido que no distingue nada,
// porque todas las tarjetas mostrarían un color.

const BORDE_CATEGORIA: Record<AuditCategory, string> = {
  etapa: 'border-l-primary',
  certificador: 'border-l-pending',
  firma: 'border-l-verified',
  liberacion: 'border-l-verified',
  documento: 'border-l-info'
}

interface NotificationCardProps {
  icon: LucideIcon
  title: string
  body?: string
  /** Ya formateado con `Intl` (regla 14): relativo o absoluto, lo decide quien usa. */
  timestampLabel: string
  read: boolean
  /** Con esto se pinta el borde izquierdo. Solo cuando la lista está filtrada. */
  category?: AuditCategory
  /** Para el check de leída. */
  readLabel: string
  onOpen?: () => void
  testId?: string
  className?: string
}

export function NotificationCard({
  icon: Icon,
  title,
  body,
  timestampLabel,
  read,
  category,
  readLabel,
  onOpen,
  testId,
  className
}: NotificationCardProps) {
  const Contenedor = onOpen ? 'button' : 'div'

  return (
    <Contenedor
      {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
      data-testid={testId}
      className={cn(
        'flex w-full items-start gap-s3 rounded-lg p-s3 text-left shadow-e1',
        // Sin leer — tinte púrpura suave. Leída — fondo normal.
        read ? 'bg-card' : 'bg-primary-light',
        category ? cn('border-l-4', BORDE_CATEGORIA[category]) : null,
        className
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          read ? 'bg-surface-alt text-text-muted' : 'bg-primary text-white'
        )}
      >
        <Icon className="size-icon-sm" aria-hidden="true" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-s1">
        <span className="flex items-baseline justify-between gap-s2">
          <span className="truncate text-body font-bold text-text-primary">{title}</span>
          <span className="shrink-0 text-caption text-text-muted">{timestampLabel}</span>
        </span>
        {body ? <span className="text-body-sm text-text-secondary">{body}</span> : null}
      </span>

      {read ? (
        <Check
          role="img"
          aria-label={readLabel}
          className="size-icon-sm shrink-0 text-text-muted"
        />
      ) : null}
    </Contenedor>
  )
}
