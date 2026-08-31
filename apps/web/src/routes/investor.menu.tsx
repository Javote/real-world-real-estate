import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Bell, Heart, Home, ShoppingBag } from 'lucide-react'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ActionCard } from '#/components/domain/ActionCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 filas 31-32 · `/investor/menu`** — Test ID: INV-MENU-001.
//
// La única superficie del backlog cuya columna de endpoints dice **"n/a (client
// routing)"**: es un agregador y no pide datos. Por eso no tiene `useQuery`.
//
// **Solo lista destinos que existen.** Un menú con tiles que llevan a pantallas
// sin construir se ve terminado y no lo está — y es peor que un menú corto,
// porque promete. Los que faltan entran con su vertical.

export const Route = createFileRoute('/investor/menu')({ component: InvestorMenu })

function InvestorMenu() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (!ready) return null

  const destinos = [
    {
      to: '/investor/buy' as const,
      title: t('nav.investor.buy'),
      desc: t('menu.buy'),
      icon: ShoppingBag
    },
    {
      to: '/investor/units' as const,
      title: t('nav.investor.units'),
      desc: t('menu.units'),
      icon: Home
    },
    {
      to: '/investor/favorites' as const,
      title: t('nav.investor.favorites'),
      desc: t('menu.favorites'),
      icon: Heart
    },
    {
      to: '/investor/notifications' as const,
      title: t('investor.notifications.title'),
      desc: t('menu.notifications'),
      icon: Bell
    }
  ]

  return (
    <PanelLayout
      rol="investor"
      title={t('investor.menu.title')}
      context={t('investor.menu.context')}
    >
      <section className="grid grid-cols-2 gap-s3" data-testid="INV-MENU-001">
        {destinos.map((d) => (
          <ActionCard
            key={d.to}
            title={d.title}
            description={d.desc}
            icon={d.icon}
            onClick={() => void navigate({ to: d.to })}
          />
        ))}
      </section>
    </PanelLayout>
  )
}
