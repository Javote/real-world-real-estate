import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/cn'

// M2-D3 §Cards · ActionCard — tile de una grilla de acciones.
//
// La variante `featured` es fondo morado lleno con texto blanco: es el tile
// "New project" del panel del developer (captura 33).
//
// `compact` es la grilla de 4 del detalle de proyecto (captura 37): ícono +
// label en una línea, sin descripción. M2-D3 ya marca la descripción como
// opcional; esto solo achica el tile para que no ocupe el doble.

interface ActionCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  featured?: boolean
  /** Ícono y label en una fila. La captura 37 no lleva descripción. */
  compact?: boolean
  onClick: () => void
  testId?: string
}

export function ActionCard({
  title,
  description,
  icon: Icon,
  featured,
  compact,
  onClick,
  testId
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'w-full text-left shadow-e1',
        compact
          ? 'flex flex-row items-center gap-s3 rounded-xl p-s3'
          : 'flex h-full flex-col items-start gap-s2 rounded-xl p-s4',
        featured ? 'bg-primary text-white' : 'bg-card text-text-primary'
      )}
    >
      {Icon ? (
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            featured ? 'bg-white/20 text-white' : 'bg-primary-light text-primary'
          )}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col gap-s1">
        <span className={cn('font-bold', compact ? 'text-body' : 'text-h2')}>{title}</span>
        {description && !compact ? (
          <span className={cn('text-body-sm', featured ? 'text-white/80' : 'text-text-muted')}>
            {description}
          </span>
        ) : null}
      </span>
    </button>
  )
}
