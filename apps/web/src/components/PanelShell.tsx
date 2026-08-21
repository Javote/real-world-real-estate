// Composición compartida por los 4 shells de panel de SPEC-011. No es un
// componente de dominio de M2-D3 (esos van en components/domain/): es el
// layout interno que los combina — GradientHeader + BottomNav/sidebar +
// contenido — para no repetirlo cuatro veces.
import type { ReactNode } from 'react'
import { GradientHeader } from './domain/GradientHeader'
import { BottomNav, type BottomNavItem } from './domain/BottomNav'
import { LanguageToggle } from './domain/LanguageToggle'

interface PanelShellProps {
  title: string
  navItems: BottomNavItem[]
  children: ReactNode
  // Slot para utilidades adicionales del header (p. ej. NotificationBell en
  // INV Buy/Menu — M2-D1 §Reusable navigation components). LanguageToggle
  // siempre está presente; esto se agrega a su lado.
  extraHeaderSlot?: ReactNode
}

export function PanelShell({ title, navItems, children, extraHeaderSlot }: PanelShellProps) {
  return (
    <div className="min-h-screen md:flex" style={{ backgroundColor: '#F4F1ED' }}>
      <BottomNav items={navItems} />
      <div className="flex-1 pb-20 md:pb-4">
        <GradientHeader
          title={title}
          right={
            <>
              {extraHeaderSlot}
              <LanguageToggle />
            </>
          }
        />
        <main className="px-4 py-4">{children}</main>
      </div>
    </div>
  )
}
