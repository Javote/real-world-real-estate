import { createFileRoute } from '@tanstack/react-router'
import { Building2, Heart, Menu, ShoppingBag, User } from 'lucide-react'
import { INVESTOR_ROLES } from '../auth/roles'
import { useRoleGuard } from '../auth/useRoleGuard'
import type { BottomNavItem } from '../components/domain/BottomNav'
import { NotificationBell } from '../components/domain/NotificationBell'
import { StatCard } from '../components/domain/StatCard'
import { PanelShell } from '../components/PanelShell'
import { useTranslation } from '../i18n/useTranslation'

export const Route = createFileRoute('/investor/buy')({ component: InvestorBuyScreen })

function InvestorBuyScreen() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t } = useTranslation()

  if (!ready) return null

  const navItems: BottomNavItem[] = [
    { key: 'menu', label: t('nav.investor.menu'), icon: Menu },
    { key: 'favorites', label: t('nav.investor.favorites'), icon: Heart },
    { key: 'buy', label: t('nav.investor.buy'), icon: ShoppingBag, to: '/investor/buy' },
    { key: 'units', label: t('nav.investor.units'), icon: Building2 },
    { key: 'user', label: t('nav.investor.user'), icon: User }
  ]

  return (
    <PanelShell
      title={t('panel.investor.title')}
      navItems={navItems}
      extraHeaderSlot={<NotificationBell label={t('notifications.ariaLabel')} />}
    >
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Building2}
          tint="portfolio"
          value={t('panel.emptyValue')}
          label={t('panel.comingSoon')}
        />
      </div>
    </PanelShell>
  )
}
