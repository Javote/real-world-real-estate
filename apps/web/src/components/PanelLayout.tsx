import type { ReactNode } from 'react'
import { BottomNav } from '#/components/domain/BottomNav'
import { GradientHeader } from '#/components/domain/GradientHeader'
import { LanguageToggle } from '#/components/domain/LanguageToggle'
import { NotificationBell } from '#/components/domain/NotificationBell'
import { NAV_TABS } from '#/components/domain/navTabs'
import { useTranslation } from '#/i18n/useTranslation'

// El armazón que comparten los cuatro paneles de rol: header con gradiente,
// contenido, y el BottomNav scopeado al rol.
//
// No es un componente de M2-D3 — es composición. Las cuatro capturas (2, 33,
// 51, 55) muestran exactamente esta estructura, y repetirla cuatro veces sería
// garantizar que se desincronicen.

interface PanelLayoutProps {
  rol: keyof typeof NAV_TABS
  title: string
  /** "Welcome, Esc. Ana Torres" — la línea bajo el título. */
  context?: string
  /** Solo en paneles primarios (M2-D3 §NotificationBell §Usage rules). */
  unread?: number
  onOpenNotifications?: () => void
  children: ReactNode
}

export function PanelLayout({
  rol,
  title,
  context,
  unread,
  onOpenNotifications,
  children
}: PanelLayoutProps) {
  const { t } = useTranslation()

  const tabs = NAV_TABS[rol].map((tab) => ({ ...tab, label: t(tab.labelKey) }))

  return (
    <div className="min-h-dvh bg-app-bg pb-24">
      <GradientHeader
        title={title}
        {...(context ? { context } : {})}
        right={
          <>
            {onOpenNotifications ? (
              <NotificationBell
                unread={unread ?? 0}
                onClick={onOpenNotifications}
                ariaLabel={t('notifications.ariaLabel')}
              />
            ) : null}
            <LanguageToggle />
          </>
        }
      />

      <main className="flex flex-col gap-s4 p-s4">{children}</main>

      <BottomNav tabs={tabs} ariaLabel={t('nav.ariaLabel')} />
    </div>
  )
}
