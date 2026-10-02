import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/cn'

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
  helper?: string
  icon?: LucideIcon
  tone?: StatTone
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
        <span className={cn('text-body-sm', highlighted ? 'text-white' : 'text-text-muted')}>
          {helper}
        </span>
      ) : null}
    </Elemento>
  )
}
