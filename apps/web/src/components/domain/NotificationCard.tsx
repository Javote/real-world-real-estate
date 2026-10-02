import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { cn } from '#/lib/cn'
import type { AuditCategory } from './AuditEventCard'

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
  timestampLabel: string
  read: boolean
  category?: AuditCategory
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
        <Icon className="size-icon-inline" aria-hidden="true" />
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
          className="size-icon-inline shrink-0 text-text-muted"
        />
      ) : null}
    </Contenedor>
  )
}
