import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/cn'

// M2-D3 §Foundation · StatCard — *"the most-reused unit in the platform"*.
//
// El color del ícono **es semántico, no decorativo** (M2-D3): verde =
// financiero, morado = entidad/inventario, naranja = tendencia, azul =
// portfolio, rosa = personas, teal = verificación. Por eso es una unión y no un
// string de clase.
//
// Y "always pair the number with a label — the number alone is never used": el
// label no es opcional en el tipo.

export type StatTone = 'financial' | 'entity' | 'trend' | 'portfolio' | 'people' | 'verification'

const BADGES: Record<StatTone, string> = {
  financial: 'bg-verified text-white',
  entity: 'bg-primary text-white',
  trend: 'bg-pending text-white',
  portfolio: 'bg-info text-white',
  people: 'bg-people text-white',
  verification: 'bg-verified text-white'
}

interface StatCardProps {
  value: string
  label: string
  /** La línea chica de abajo: "of construction completed", "3 total". */
  helper?: string
  icon?: LucideIcon
  tone?: StatTone
  /** Variante de fondo lleno: el tile "New project" del panel del developer. */
  highlighted?: boolean
  onClick?: () => void
}

export function StatCard({
  value,
  label,
  helper,
  icon: Icon,
  tone = 'entity',
  highlighted,
  onClick
}: StatCardProps) {
  const Elemento = onClick ? 'button' : 'div'

  return (
    <Elemento
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex w-full flex-col items-start gap-s2 rounded-xl p-s4 text-left shadow-e1',
        highlighted ? 'bg-primary text-white' : 'bg-card'
      )}
    >
      {Icon ? (
        <span
          // Badge de 40px con ícono de 20px (M2-D3 §Sizes).
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            highlighted ? 'bg-white/20 text-white' : BADGES[tone]
          )}
        >
          <Icon size={20} aria-hidden="true" />
        </span>
      ) : null}

      <span className={cn('text-stat font-bold', highlighted ? 'text-white' : 'text-text-primary')}>
        {value}
      </span>
      <span className={cn('font-bold', highlighted ? 'text-white' : 'text-text-primary')}>
        {label}
      </span>
      {helper ? (
        <span className={cn('text-body-sm', highlighted ? 'text-white/80' : 'text-text-muted')}>
          {helper}
        </span>
      ) : null}
    </Elemento>
  )
}
