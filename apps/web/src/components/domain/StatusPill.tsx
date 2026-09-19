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
        // **`whitespace-nowrap` no es cosmética.** Un pill es `rounded-full`:
        // si el texto envuelve, el radio deja de ser una cápsula y se convierte
        // en un óvalo alto que no se parece a ningún estado de M2-D3. Y pasa
        // con el español, no con el inglés — "En planificación" envuelve donde
        // "Planning" no (M2-D3 §Text growth: 20-30% más largo).
        //
        // Lo que cede es el TÍTULO, que envuelve bien: por eso el pill también
        // va `shrink-0`. Es la excepción a "nada de anchos fijos" — no se fija
        // un ancho, se le prohíbe encogerse por debajo de su contenido.
        //
        // **`shrink-0` gobierna el eje PRINCIPAL, no el cruzado** (SPEC-106,
        // F-10): como hijo directo de una columna (`flex flex-col`), el pill
        // se blockifica y `align-items: stretch` lo estira al ancho del
        // contenedor sin que `shrink-0` lo evite. Quien lo monte dentro de una
        // columna necesita pasar `className="self-start"` — el componente no
        // puede saberlo por sí solo, porque en una fila (`flex`) no hace falta.
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-s2 py-s1 text-caption font-medium',
        TONOS[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
