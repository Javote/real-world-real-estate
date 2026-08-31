import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { User } from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '#/api/port'
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
//
// **El header es uno (D-074).** Logo + campana + perfil + idioma, siempre.
// `back` es lo único que la pantalla decide: si hay padre, se pasa; si no, no.
// La flecha no reemplaza al logo. Las utilidades no se opt-in por pantalla:
// si una ruta las olvida, igual están.
//
// Solo el investor tiene inbox en M2-D5 (`/investor/notifications`). La
// campana igual se monta en los cuatro roles: cuenta no leídas con
// GET /notifications/unread-count, que es cross-rol, y en developer / notary /
// certifier cae al panel. No se inventa una superficie de inbox.

interface PanelLayoutProps {
  rol: keyof typeof NAV_TABS
  title: string
  /** "Welcome, Esc. Ana Torres" — la línea bajo el título. */
  context?: string
  /** "← Back to panel" / "← Back". Entre el logo y el título, nunca en su lugar. */
  back?: { label: string; onClick: () => void }
  /**
   * Acción primaria de la pantalla, alineada con el título (el "+ Nuevo" de la
   * captura 35-36). No compite con las utilidades globales del slot derecho:
   * ver `titleAction` en GradientHeader.
   */
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

  const abrirPerfil = () => {
    switch (rol) {
      case 'investor':
        return void navigate({ to: '/investor/profile' })
      case 'developer':
        return void navigate({ to: '/developer/profile' })
      case 'notary':
        return void navigate({ to: '/notary/profile' })
      case 'certifier':
        return void navigate({ to: '/certifier/profile' })
    }
  }

  const abrirNotificaciones = () => {
    switch (rol) {
      case 'investor':
        return void navigate({ to: '/investor/notifications' })
      case 'developer':
        return void navigate({ to: '/developer' })
      case 'notary':
        return void navigate({ to: '/notary' })
      case 'certifier':
        return void navigate({ to: '/certifier' })
    }
  }

  return (
    <div className="min-h-dvh bg-app-bg pb-24">
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
              ariaLabel={t('notifications.ariaLabel')}
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

      <main className="flex flex-col gap-s4 p-s4">{children}</main>

      <BottomNav tabs={tabs} ariaLabel={t('nav.ariaLabel')} />
    </div>
  )
}
