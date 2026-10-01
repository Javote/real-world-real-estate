import { Building2, Mail } from 'lucide-react'
import { cn } from '#/lib/cn'
import { StatusPill, type StatusTone } from './StatusPill'

export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

interface InvestorCardProps {
  fullName: string
  email: string
  investedLabel: string
  unitLabel: string
  projectName: string
  investmentHeading: string
  unitHeading: string
  status?: { tone: StatusTone; label: string }
  onOpen?: () => void
  className?: string
}

export function InvestorCard({
  fullName,
  email,
  investedLabel,
  unitLabel,
  projectName,
  investmentHeading,
  unitHeading,
  status,
  onOpen,
  className
}: InvestorCardProps) {
  const Contenedor = onOpen ? 'button' : 'div'

  return (
    <Contenedor
      {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
      className={cn(
        'flex w-full items-start gap-s3 rounded-lg bg-card p-s3 text-left shadow-e1',
        onOpen && 'transition-transform active:scale-[0.99]',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-people-light text-body-sm font-medium text-people"
      >
        {iniciales(fullName)}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-s2">
        <span className="flex items-start justify-between gap-s2">
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body font-medium text-text-primary">{fullName}</span>
            <span className="flex items-center gap-s1 text-caption text-text-muted">
              <Mail className="size-icon-inline shrink-0" aria-hidden="true" />
              <span className="truncate">{email}</span>
            </span>
          </span>
          {status ? (
            <StatusPill tone={status.tone} className="shrink-0">
              {status.label}
            </StatusPill>
          ) : null}
        </span>

        <span className="grid grid-cols-3 gap-s2">
          <span className="flex min-w-0 flex-col">
            <span className="text-caption text-text-muted">{investmentHeading}</span>
            <span className="truncate text-body font-medium text-text-primary">
              {investedLabel}
            </span>
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-caption text-text-muted">{unitHeading}</span>
            <span className="truncate text-body font-medium text-text-primary">{unitLabel}</span>
          </span>
          <span className="flex min-w-0 items-end gap-s1 text-caption text-text-muted">
            <Building2 className="size-icon-inline shrink-0" aria-hidden="true" />
            <span className="truncate">{projectName}</span>
          </span>
        </span>
      </span>
    </Contenedor>
  )
}
