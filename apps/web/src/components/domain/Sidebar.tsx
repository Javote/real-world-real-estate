import { Link } from '@tanstack/react-router'
import { cn } from '#/lib/cn'
import type { NavTab } from './BottomNav'
import { tabNeedsExactMatch } from './BottomNav'
import { PropNexusMark } from './PropNexusMark'

// M2-D3 §Principle 4 — "the desktop responsive layout swaps the BottomNav for
// a left sidebar and adds columns, but the component model is identical". Es
// la misma navegación de `NAV_TABS`, mismos tabs y mismo orden — solo cambia
// la orientación y que acá sí hay lugar para la marca. `M2-D2` captura 61
// (`61-DESKTOP-HOME.png`) es la única referencia visual de desktop en todo el
// catálogo: el tab activo se pinta como una píldora sólida `bg-primary`, no
// solo texto en color — a diferencia del BottomNav, que sí alcanza con texto.
//
// Reemplaza al BottomNav en desktop (`md:hidden` allá, `md:flex` acá) — nunca
// los dos juntos.

interface SidebarProps {
  tabs: readonly NavTab[]
  ariaLabel: string
}

export function Sidebar({ tabs, ariaLabel }: SidebarProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-card md:flex"
    >
      <div className="bg-linear-to-br from-primary to-primary-dark px-s4 py-s4 text-white">
        <PropNexusMark />
      </div>

      <div className="flex flex-1 flex-col gap-s1 p-s3">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: tabNeedsExactMatch(tab.to, tabs) }}
            className={cn('flex items-center gap-s3 rounded-full px-s4 py-s3 text-body')}
            activeProps={{ className: 'bg-primary text-white font-bold' }}
            inactiveProps={{ className: 'text-text-muted' }}
          >
            <tab.icon size={20} aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
