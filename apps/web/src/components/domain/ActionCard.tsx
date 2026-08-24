import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/cn'

// M2-D3 §Cards · ActionCard — tile de una grilla de acciones.
//
// La variante `featured` es fondo morado lleno con texto blanco: es el tile
// "New project" del panel del developer (captura 33).

interface ActionCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  featured?: boolean
  onClick: () => void
  testId?: string
}

export function ActionCard({
  title,
  description,
  icon: Icon,
  featured,
  onClick,
  testId
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'flex h-full w-full flex-col items-start gap-s2 rounded-xl p-s4 text-left shadow-e1',
        featured ? 'bg-primary text-white' : 'bg-card text-text-primary'
      )}
    >
      {Icon ? (
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            featured ? 'bg-white/20 text-white' : 'bg-primary-light text-primary'
          )}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
      ) : null}
      <span className="text-h2 font-bold">{title}</span>
      {description ? (
        <span className={cn('text-body-sm', featured ? 'text-white/80' : 'text-text-muted')}>
          {description}
        </span>
      ) : null}
    </button>
  )
}
