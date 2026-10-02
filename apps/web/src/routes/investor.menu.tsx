import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Bell, Heart, Home, ShoppingBag } from 'lucide-react'
import { ActionCard } from '#/components/domain/ActionCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

export const Route = createFileRoute('/investor/menu')({ component: InvestorMenu })

function InvestorMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()

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
    <PanelLayout title={t('investor.menu.title')} context={t('investor.menu.context')}>
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
