import { createFileRoute } from '@tanstack/react-router'
import { ClipboardCheck, LayoutGrid, PenLine, UserCircle } from 'lucide-react'
import { NOTARY_ROLES } from '../auth/roles'
import { useRoleGuard } from '../auth/useRoleGuard'
import type { BottomNavItem } from '../components/domain/BottomNav'
import { StatCard } from '../components/domain/StatCard'
import { PanelShell } from '../components/PanelShell'
import { useTranslation } from '../i18n/useTranslation'

export const Route = createFileRoute('/notary')({ component: NotaryScreen })

function NotaryScreen() {
  const { ready } = useRoleGuard(NOTARY_ROLES)
  const { t } = useTranslation()

  if (!ready) return null

  const navItems: BottomNavItem[] = [
    { key: 'panel', label: t('nav.notary.panel'), icon: LayoutGrid, to: '/notary' },
    { key: 'dossiers', label: t('nav.notary.dossiers'), icon: ClipboardCheck },
    { key: 'signed', label: t('nav.notary.signed'), icon: PenLine },
    { key: 'profile', label: t('nav.notary.profile'), icon: UserCircle }
  ]

  return (
    <PanelShell title={t('panel.notary.title')} navItems={navItems}>
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={ClipboardCheck}
          tint="verification"
          value={t('panel.emptyValue')}
          label={t('panel.comingSoon')}
        />
      </div>
    </PanelShell>
  )
}
