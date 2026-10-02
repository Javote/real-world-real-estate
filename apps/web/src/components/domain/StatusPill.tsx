import { cn } from '#/lib/cn'

export type StatusTone = 'verified' | 'pending' | 'info' | 'neutral'

export const TONOS: Record<StatusTone, string> = {
  verified: 'bg-verified-light text-verified',
  pending: 'bg-pending-light text-pending',
  info: 'bg-info-light text-info',
  neutral: 'bg-surface-alt text-text-secondary'
}

interface StatusPillProps {
  tone: StatusTone
  children: React.ReactNode
  className?: string
}

export function StatusPill({ tone, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-s2 py-s1 text-caption font-medium',
        TONOS[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
