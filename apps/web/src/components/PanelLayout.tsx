import { User } from 'lucide-react'
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
  /**
   * Acceso al perfil desde el slot derecho del header (D-072).
   *
   * **Solo lo pasa el rol que no tiene tab de perfil.** Investor llega por su
   * tab 5 ("User"); notary y certifier por su tab 4 ("Profile"). El developer
   * es el único de los cuatro que M2-D1 dejó sin entrada, y M2-D3
   * §GradientHeader reserva este slot justamente para utilidades globales.
   */
  onOpenProfile?: () => void
  /**
   * "← Back to panel" / "← Back". **No implica ocultar el logo.**
   *
   * Las capturas del developer mezclan los dos patrones en secciones del
   * mismo nivel (Documentación 46 va sin logo, Audit log 49 va con logo).
   * `hideBrand` es el booleano que elige; pasarlo atado a `back` hacía
   * inalcanzable el patrón B.
   */
  back?: { label: string; onClick: () => void }
  /**
   * Patrón A: el back reemplaza al logo. Ausente, el logo queda y el back
   * va entre la marca y el título (patrón B: capturas 37, 38, 39, 44b, 49).
   */
  hideBrand?: boolean
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
  unread,
  onOpenNotifications,
  onOpenProfile,
  back,
  hideBrand,
  headerAction,
  children
}: PanelLayoutProps) {
  const { t } = useTranslation()

  const tabs = NAV_TABS[rol].map((tab) => ({ ...tab, label: t(tab.labelKey) }))

  return (
    <div className="min-h-dvh bg-app-bg pb-24">
      <GradientHeader
        title={title}
        {...(context ? { context } : {})}
        {...(back ? { back } : {})}
        {...(hideBrand ? { hideBrand: true } : {})}
        {...(headerAction ? { titleAction: headerAction } : {})}
        right={
          <>
            {onOpenNotifications ? (
              <NotificationBell
                unread={unread ?? 0}
                onClick={onOpenNotifications}
                ariaLabel={t('notifications.ariaLabel')}
              />
            ) : null}
            {onOpenProfile ? (
              <button
                type="button"
                onClick={onOpenProfile}
                aria-label={t('profile.ariaLabel')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
              >
                <User size={20} aria-hidden="true" />
              </button>
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
