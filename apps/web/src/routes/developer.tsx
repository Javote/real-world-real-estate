import { createFileRoute } from '@tanstack/react-router'
import { Briefcase, Building2, LayoutGrid, TrendingUp, Wallet } from 'lucide-react'
import { DEV_ROLES } from '../auth/roles'
import { useRoleGuard } from '../auth/useRoleGuard'
import type { BottomNavItem } from '../components/domain/BottomNav'
import { StatCard } from '../components/domain/StatCard'
import { PanelShell } from '../components/PanelShell'
import { useTranslation } from '../i18n/useTranslation'

export const Route = createFileRoute('/developer')({ component: DeveloperScreen })

function DeveloperScreen() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()

  if (!ready) return null

  const navItems: BottomNavItem[] = [
    { key: 'panel', label: t('nav.developer.panel'), icon: LayoutGrid, to: '/developer' },
    { key: 'projects', label: t('nav.developer.projects'), icon: Briefcase },
    { key: 'capital', label: t('nav.developer.capital'), icon: Wallet },
    { key: 'units', label: t('nav.developer.units'), icon: Building2 },
    { key: 'progress', label: t('nav.developer.progress'), icon: TrendingUp }
  ]

  return (
    <PanelShell title={t('panel.developer.title')} navItems={navItems}>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Wallet}
          tint="financial"
          value={t('panel.emptyValue')}
          label={t('panel.comingSoon')}
        />
      </div>
    </PanelShell>
  )
}
