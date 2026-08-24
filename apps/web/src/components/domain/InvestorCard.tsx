import { cn } from '#/lib/cn'
import { StatusPill, type StatusTone } from './StatusPill'

// M2-D3 §Cards · InvestorCard — fila del directorio de investors del developer
// (captura 48).
//
// **Las iniciales se derivan del nombre y no viajan aparte.** Un avatar es
// presentación: pedirle al backend que mande "MA" sería inventar un campo para
// algo que el cliente calcula. Y el nombre y el email ya están en la respuesta
// porque el developer es contraparte de esa operación — nada nuevo se expone.

/** Primeras letras de las dos primeras palabras del nombre. */
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
  /** Ya formateado con `Intl` (reglas 1 y 14). */
  investedLabel: string
  unitLabel: string
  projectName: string
  status: { tone: StatusTone; label: string }
  onOpen?: () => void
  className?: string
}

export function InvestorCard({
  fullName,
  email,
  investedLabel,
  unitLabel,
  projectName,
  status,
  onOpen,
  className
}: InvestorCardProps) {
  const Contenedor = onOpen ? 'button' : 'div'

  return (
    <Contenedor
      {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
      className={cn(
        'flex w-full items-center gap-s3 rounded-lg bg-card p-s3 text-left shadow-e1',
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

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium text-text-primary">{fullName}</span>
        <span className="truncate text-caption text-text-muted">{email}</span>
        <span className="truncate text-caption text-text-muted">
          {investedLabel} · {unitLabel} · {projectName}
        </span>
      </span>

      <StatusPill tone={status.tone} className="shrink-0">
        {status.label}
      </StatusPill>
    </Contenedor>
  )
}
