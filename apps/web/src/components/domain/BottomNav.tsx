import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '#/lib/cn'

export interface NavTab {
  to: string
  label: string
  icon: LucideIcon
  fab?: boolean
}

interface BottomNavProps {
  tabs: readonly NavTab[]
  ariaLabel: string
}

export function tabNeedsExactMatch(tabTo: string, tabs: readonly { to: string }[]): boolean {
  return tabs.some((other) => other.to !== tabTo && other.to.startsWith(`${tabTo}/`))
}

export function BottomNav({ tabs, ariaLabel }: BottomNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
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
          activeOptions={{ exact: tabNeedsExactMatch(tab.to, tabs) }}
          activeProps={{ className: 'text-primary font-bold', 'aria-current': 'page' }}
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
