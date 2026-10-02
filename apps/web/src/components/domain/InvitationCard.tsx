import { Mail } from 'lucide-react'
import { cn } from '#/lib/cn'

interface InvitationCardProps {
  title: string
  body: string
  ctaLabel: string
  timestampLabel: string
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
