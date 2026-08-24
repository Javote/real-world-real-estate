import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/cn'

// M2-D3 §Foundation · BottomNav — navegación primaria mobile, **scopeada por
// rol**: la cantidad de tabs y sus etiquetas cambian según quién entró.
//
// Las cuatro composiciones salen textuales de M2-D3 §Usage rules y coinciden
// con los árboles de pantallas de M2-D1:
//
//   INV: Menu · Favorites · Buy (FAB) · Units · User
//   DEV: Panel · Projects · Capital · Units · Progress
//   NOT: Panel · Dossiers · Signed · Profile
//   CER: Panel · Assigned · Issued · Profile
//
// La variante del investor tiene un tab central tipo FAB para "Buy". En
// desktop la barra se reemplaza por un sidebar izquierdo.

export interface NavTab {
  to: string
  label: string
  icon: LucideIcon
  /** El tab central elevado del investor. Solo uno por barra. */
  fab?: boolean
}

interface BottomNavProps {
  tabs: readonly NavTab[]
  ariaLabel: string
}

export function BottomNav({ tabs, ariaLabel }: BottomNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      // `max-md:` en vez de `hidden md:` a propósito: ver la trampa de clases
      // utilitarias en apps/web/CLAUDE.md.
      className="fixed inset-x-0 bottom-0 flex items-end justify-around border-t border-border bg-card px-s2 pb-s2 pt-s2 md:hidden"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={cn(
            'flex flex-1 flex-col items-center gap-s1 text-caption',
            tab.fab ? 'relative -mt-s6' : ''
          )}
          activeProps={{ className: 'text-primary font-bold' }}
          inactiveProps={{ className: 'text-text-muted' }}
        >
          {tab.fab ? (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-verified text-white shadow-e2">
              <tab.icon size={24} aria-hidden="true" />
            </span>
          ) : (
            <tab.icon size={24} aria-hidden="true" />
          )}
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
