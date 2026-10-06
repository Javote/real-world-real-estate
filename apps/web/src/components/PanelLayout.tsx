import { useQuery } from '@tanstack/react-query'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { User } from 'lucide-react'
import { createContext, type ReactNode, useContext, useLayoutEffect, useState } from 'react'
import { api } from '#/api/port'
import { getSession } from '#/auth/session'
import { BottomNav } from '#/components/domain/BottomNav'
import { GradientHeader } from '#/components/domain/GradientHeader'
import { LanguageToggle } from '#/components/domain/LanguageToggle'
import { NotificationBell } from '#/components/domain/NotificationBell'
import { NAV_TABS } from '#/components/domain/navTabs'
import { Sidebar } from '#/components/domain/Sidebar'
import { useTranslation } from '#/i18n/useTranslation'

type Rol = keyof typeof NAV_TABS

interface Cabecera {
  title: string
  context?: string | null
  back?: { label: string; onClick: () => void }
  headerAction?: ReactNode
}

function crearCabecera() {
  let actual: Cabecera = { title: '' }
  const oyentes = new Set<() => void>()
  return {
    leer: () => actual,
    publicar: (cabecera: Cabecera) => {
      actual = cabecera
      for (const oyente of oyentes) oyente()
    },
    suscribir: (oyente: () => void) => {
      oyentes.add(oyente)
      return () => {
        oyentes.delete(oyente)
      }
    }
  }
}

type CabeceraStore = ReturnType<typeof crearCabecera>

const CabeceraContext = createContext<CabeceraStore>(crearCabecera())

export function PanelShell({ rol }: { rol: Rol }) {
  const { t } = useTranslation()
  const [cabecera] = useState(crearCabecera)
  const tabs = NAV_TABS[rol].map((tab) => ({ ...tab, label: t(tab.labelKey) }))

  return (
    <CabeceraContext value={cabecera}>
      <Sidebar tabs={tabs} ariaLabel={t('nav.ariaLabel')} />
      <div className="min-h-dvh bg-app-bg pb-24 md:pl-64">
        <EncabezadoDelPanel rol={rol} cabecera={cabecera} />

        <main className="mx-auto flex max-w-2xl flex-col gap-s4 p-s4">
          <Outlet />
        </main>

        <BottomNav tabs={tabs} ariaLabel={t('nav.ariaLabel')} />
      </div>
    </CabeceraContext>
  )
}

function EncabezadoDelPanel({ rol, cabecera }: { rol: Rol; cabecera: CabeceraStore }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [{ title, context, back, headerAction }, setActual] = useState(cabecera.leer)

  useLayoutEffect(() => cabecera.suscribir(() => setActual(cabecera.leer())), [cabecera])

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
    <GradientHeader
      title={title}
      {...(context !== undefined ? { context } : {})}
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
  )
}

interface PanelLayoutProps extends Cabecera {
  children: ReactNode
}

export function PanelLayout({ children, ...cabecera }: PanelLayoutProps) {
  const store = useContext(CabeceraContext)

  useLayoutEffect(() => store.publicar(cabecera))

  return children
}
