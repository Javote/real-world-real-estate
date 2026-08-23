import { createFileRoute } from '@tanstack/react-router'
import { Activity, FileBadge, LayoutGrid, UserCircle } from 'lucide-react'
import { CERTIFIER_ROLES } from '../auth/roles'
import { useRoleGuard } from '../auth/useRoleGuard'
import type { BottomNavItem } from '../components/domain/BottomNav'
import { StatCard } from '../components/domain/StatCard'
import { PanelShell } from '../components/PanelShell'
import { useTranslation } from '../i18n/useTranslation'

export const Route = createFileRoute('/certifier')({ component: CertifierScreen })

function CertifierScreen() {
  const { ready } = useRoleGuard(CERTIFIER_ROLES)
  const { t } = useTranslation()

  if (!ready) return null

  const navItems: BottomNavItem[] = [
    { key: 'panel', label: t('nav.certifier.panel'), icon: LayoutGrid, to: '/certifier' },
    { key: 'assigned', label: t('nav.certifier.assigned'), icon: Activity },
    { key: 'issued', label: t('nav.certifier.issued'), icon: FileBadge },
    { key: 'profile', label: t('nav.certifier.profile'), icon: UserCircle }
  ]

  return (
    <PanelShell title={t('panel.certifier.title')} navItems={navItems}>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={FileBadge}
          tint="verification"
          value={t('panel.emptyValue')}
          label={t('panel.comingSoon')}
        />
      </div>
    </PanelShell>
  )
}
