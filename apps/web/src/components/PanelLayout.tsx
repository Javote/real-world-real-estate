import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { User } from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '#/api/port'
import { getSession } from '#/auth/session'
import { BottomNav } from '#/components/domain/BottomNav'
import { GradientHeader } from '#/components/domain/GradientHeader'
import { LanguageToggle } from '#/components/domain/LanguageToggle'
import { NotificationBell } from '#/components/domain/NotificationBell'
import { NAV_TABS } from '#/components/domain/navTabs'
import { Sidebar } from '#/components/domain/Sidebar'
import { useTranslation } from '#/i18n/useTranslation'

interface PanelLayoutProps {
  rol: keyof typeof NAV_TABS
  title: string
  context?: string
  back?: { label: string; onClick: () => void }
  headerAction?: ReactNode
  children: ReactNode
}

export function PanelLayout({
  rol,
  title,
  context,
  back,
  headerAction,
  children
}: PanelLayoutProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const tabs = NAV_TABS[rol].map((tab) => ({ ...tab, label: t(tab.labelKey) }))

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: api.getUnreadCount
  })

  const esAdmin = getSession()?.user.role === 'admin'

  const abrirPerfil = () => {
    if (esAdmin) return void navigate({ to: '/admin' })
    switch (rol) {
      case 'investor':
        return void navigate({ to: '/investor/profile' })
      case 'developer':
        return void navigate({ to: '/developer/profile' })
      case 'notary':
        return void navigate({ to: '/notary/profile' })
      case 'certifier':
        return void navigate({ to: '/certifier/profile' })
      case 'admin':
        return void navigate({ to: '/admin' })
    }
  }

  const abrirNotificaciones = () => {
    if (esAdmin) return void navigate({ to: '/admin' })
    switch (rol) {
      case 'investor':
        return void navigate({ to: '/investor/notifications' })
      case 'developer':
        return void navigate({ to: '/developer' })
      case 'notary':
        return void navigate({ to: '/notary' })
      case 'certifier':
        return void navigate({ to: '/certifier' })
      case 'admin':
        return void navigate({ to: '/admin' })
    }
  }

  return (
    <>
      <Sidebar tabs={tabs} ariaLabel={t('nav.ariaLabel')} />
      <div className="min-h-dvh bg-app-bg pb-24 md:pl-64">
        <GradientHeader
          title={title}
          {...(context ? { context } : {})}
          {...(back ? { back } : {})}
          {...(headerAction ? { titleAction: headerAction } : {})}
          right={
            <>
              <NotificationBell
                unread={unread?.unread ?? 0}
                onClick={abrirNotificaciones}
                ariaLabel={
                  unread?.unread
                    ? t('notifications.bellWithCount', { count: String(unread.unread) })
                    : t('notifications.ariaLabel')
                }
              />
              <button
                type="button"
                onClick={abrirPerfil}
                aria-label={t('profile.ariaLabel')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
              >
                <User size={20} aria-hidden="true" />
              </button>
              <LanguageToggle />
            </>
          }
        />

        <main className="mx-auto flex max-w-2xl flex-col gap-s4 p-s4">{children}</main>

        <BottomNav tabs={tabs} ariaLabel={t('nav.ariaLabel')} />
      </div>
    </>
  )
}
