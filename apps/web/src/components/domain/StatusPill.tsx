import { cn } from '#/lib/cn'

// M2-D3 §Foundation · StatusPill — el mecanismo primario de señalización de
// estado de toda la plataforma.
//
// **La matriz de colores es normativa y cerrada** (M2-D3 §Status pill colour
// matrix): *"Never invent new statuses; if a new state is needed, choose the
// closest semantic mapping."* Por eso el tipo es una unión finita y no un
// string: un estado nuevo no compila.
//
// Y es la contracara visual de la regla 17: que verde signifique *anclado de
// verdad* y naranja *pendiente*, siempre, en toda la app.

/** Las cinco familias semánticas de la matriz. */
export type StatusTone = 'verified' | 'pending' | 'info' | 'neutral'

const TONOS: Record<StatusTone, string> = {
  // Verified · Signed · Certified · Paid · Released · Sold · Delivered
  verified: 'bg-verified-light text-verified',
  // Pending · Reserved · In dispute · Under construction · Observed
  pending: 'bg-pending-light text-pending',
  // Pre-construction · Completed (en contexto investor)
  info: 'bg-info-light text-info',
  // Available · Unassigned
  neutral: 'bg-surface-alt text-text-secondary'
}

interface StatusPillProps {
  tone: StatusTone
  /** Ya traducido por quien lo usa: el backend manda claves, no copy (regla 15). */
  children: React.ReactNode
  className?: string
}

export function StatusPill({ tone, children, className }: StatusPillProps) {
  return (
    <span
      // Los pills son de solo lectura: nunca se vuelven botones (M2-D3).
      className={cn(
        'inline-flex items-center rounded-full px-s2 py-s1 text-caption font-medium',
        TONOS[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
