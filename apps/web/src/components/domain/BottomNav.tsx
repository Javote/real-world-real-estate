// Componente de dominio (M2-D3 §Foundation): navegación primaria, role-scoped.
// Mobile: barra fija al pie. Desktop: se reemplaza por sidebar izquierda con
// los mismos items y orden (M2-D1 §Responsive behavior).
import type { LucideIcon } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from '../../i18n/useTranslation'

// Los únicos 4 landings reales de esta rebanada (SPEC-011). Un tab de una
// pantalla que todavía no existe (Favorites, Projects, etc.) no lleva `to`:
// invariante 9 — visible pero no navegable, nunca a un 404 sin estilo.
type ShellPath = '/investor/buy' | '/developer' | '/notary' | '/certifier'

export interface BottomNavItem {
  key: string
  label: string
  icon: LucideIcon
  to?: ShellPath
}

export function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { t } = useTranslation()
  const ariaLabel = t('nav.ariaLabel')

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex items-stretch justify-around border-t bg-white md:hidden"
        style={{ borderColor: '#E5E7EB' }}
        aria-label={ariaLabel}
      >
        {items.map((item) => (
          <NavButton key={item.key} item={item} active={item.to === pathname} />
        ))}
      </nav>
      {/* `flex max-md:hidden`, no `hidden md:flex`: la clase bare `.hidden` de
          Tailwind choca con la `.hidden { display: none !important; }` del
          CSS legado de styles.css (D-024, todavía cargado) y su `!important`
          gana siempre, sin importar la media query. `max-md:hidden` es un
          selector distinto (`.max-md\:hidden`) que no colisiona. Ver
          apps/web/CLAUDE.md §Trampas. */}
      <aside
        className="flex max-md:hidden w-56 shrink-0 flex-col gap-1 border-r bg-white p-3"
        style={{ borderColor: '#E5E7EB' }}
        aria-label={ariaLabel}
      >
        {items.map((item) => (
          <NavButton key={item.key} item={item} active={item.to === pathname} vertical />
        ))}
      </aside>
    </>
  )
}

function NavButton({
  item,
  active,
  vertical,
}: {
  item: BottomNavItem
  active: boolean
  vertical?: boolean
}) {
  const Icon = item.icon
  const color = active ? '#6D4AFF' : '#6B7280'
  const className = vertical
    ? 'flex flex-row items-center gap-3 rounded-lg px-3 py-2 text-sm'
    : 'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs'
  const label = <span style={{ color, fontWeight: active ? 700 : 400 }}>{item.label}</span>
  const icon = <Icon size={24} strokeWidth={2} color={color} aria-hidden="true" />

  if (item.to) {
    return (
      <Link to={item.to} className={className}>
        {icon}
        {label}
      </Link>
    )
  }

  // Tab de una pantalla que esta rebanada no implementa todavía: se muestra,
  // no navega a ningún lado y no rompe la app (invariante 9).
  return (
    <button type="button" className={className} aria-disabled="true">
      {icon}
      {label}
    </button>
  )
}
